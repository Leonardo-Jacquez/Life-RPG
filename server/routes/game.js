'use strict';

// Student game routes:
//   GET    /game/run/active           — get or create the active game run
//   GET    /game/event/next           — draw the next event for this run
//   POST   /game/event/choice         — submit a choice for the current event
//   GET    /game/paths                — get available post-secondary paths
//   POST   /game/phase/advance        — advance to next phase
//   GET    /game/budget               — compute monthly budget (adult phase)
//   GET    /game/outcome              — compute final outcome score
//   GET    /game/runs                 — list all of the student's game runs

const express = require('express');
const { query, transaction } = require('../db');
const { requireAuth, requireStudent } = require('../middleware/auth');
const { gameLimit } = require('../middleware/rateLimit');
const engine = require('@life-rpg/engine');

const router = express.Router();
router.use(requireAuth, requireStudent);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToStats(run) {
  return {
    academic:   run.stat_academic,
    financial:  run.stat_financial,
    work_ethic: run.stat_work_ethic,
    social:     run.stat_social,
  };
}

function rowToGameRun(row) {
  return {
    id:         row.id,
    student_id: row.student_id,
    class_id:   row.class_id,
    run_number: row.run_number,
    phase:      row.phase,
    path_id:    row.path_id,
    net_worth:  parseFloat(row.net_worth ?? 0),
    stats:      rowToStats(row),
    character_prefs: row.character_prefs ?? {},
    is_complete: row.is_complete,
  };
}

async function getArchetypes(researchUuid) {
  const { rows } = await query(
    `SELECT score_O AS "O", score_C AS "C", score_E AS "E",
            score_A AS "A", score_N AS "N",
            score_grit AS grit, score_ftp AS ftp
     FROM psychometric_profiles WHERE research_uuid = $1`,
    [researchUuid]
  );
  return rows[0] ?? {};
}

async function getSeenEventIds(gameRunId) {
  const { rows } = await query(
    'SELECT DISTINCT event_id FROM game_event_log WHERE game_run_id = $1',
    [gameRunId]
  );
  return new Set(rows.map(r => String(r.event_id)));
}

// ─── GET /game/run/active ─────────────────────────────────────────────────────

router.get('/run/active', async (req, res) => {
  const studentId = req.user.sub;
  const classId   = req.query.class_id ?? req.user.classId;

  if (!classId) return res.status(400).json({ error: 'class_id is required' });

  try {
    // Find the most recent incomplete run
    const { rows } = await query(
      `SELECT * FROM game_runs
       WHERE student_id = $1 AND class_id = $2 AND is_complete = false
       ORDER BY run_number DESC LIMIT 1`,
      [studentId, classId]
    );

    if (rows.length > 0) {
      return res.json({ run: rowToGameRun(rows[0]) });
    }

    // Count existing runs to determine run_number
    const { rows: countRows } = await query(
      'SELECT COUNT(*) AS cnt FROM game_runs WHERE student_id = $1 AND class_id = $2',
      [studentId, classId]
    );
    const runNumber = parseInt(countRows[0].cnt) + 1;

    // Create a new run
    const { rows: newRows } = await query(
      `INSERT INTO game_runs (student_id, class_id, run_number)
       VALUES ($1, $2, $3) RETURNING *`,
      [studentId, classId, runNumber]
    );

    return res.status(201).json({ run: rowToGameRun(newRows[0]) });
  } catch (err) {
    console.error('[game/run/active]', err);
    return res.status(500).json({ error: 'Failed to fetch or create game run' });
  }
});

// ─── GET /game/runs ───────────────────────────────────────────────────────────

router.get('/runs', async (req, res) => {
  const studentId = req.user.sub;
  const classId   = req.query.class_id ?? req.user.classId;

  try {
    const { rows } = await query(
      `SELECT * FROM game_runs WHERE student_id = $1 AND class_id = $2 ORDER BY run_number`,
      [studentId, classId]
    );
    return res.json({ runs: rows.map(rowToGameRun) });
  } catch (err) {
    console.error('[game/runs]', err);
    return res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

// ─── GET /game/event/next ─────────────────────────────────────────────────────

router.get('/event/next', async (req, res) => {
  const { run_id } = req.query;
  if (!run_id) return res.status(400).json({ error: 'run_id is required' });

  try {
    const { rows: runRows } = await query('SELECT * FROM game_runs WHERE id = $1', [run_id]);
    if (!runRows.length) return res.status(404).json({ error: 'Game run not found' });

    const run = rowToGameRun(runRows[0]);
    if (run.student_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });

    // Fetch event pool for current phase
    const { rows: eventRows } = await query(
      `SELECT de.*, json_agg(ec ORDER BY ec.choice_order) AS choices
       FROM decision_events de
       JOIN event_choices ec ON ec.event_id = de.id
       WHERE de.phase = $1
       GROUP BY de.id`,
      [run.phase]
    );

    if (eventRows.length === 0) {
      return res.json({ event: null, message: 'No more events for this phase' });
    }

    const seenIds = await getSeenEventIds(run_id);

    // Fetch any active ripple boosts for this student
    const { rows: sessionRows } = await query(
      `SELECT pending_choices FROM class_sessions
       WHERE class_id = $1 AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`,
      [run.class_id]
    );

    const rippleBoosts = (run.character_prefs?.ripple_boosts) ?? {};

    const nextEvent = engine.drawNextEvent(
      eventRows,
      { ...run, run_number: run.run_number },
      seenIds,
      new Set(),
      rippleBoosts
    );

    if (!nextEvent) {
      return res.json({ event: null, message: 'No eligible events remaining' });
    }

    return res.json({ event: nextEvent });
  } catch (err) {
    console.error('[game/event/next]', err);
    return res.status(500).json({ error: 'Failed to draw next event' });
  }
});

// ─── POST /game/event/choice ──────────────────────────────────────────────────

router.post('/event/choice', gameLimit, async (req, res) => {
  const { run_id, event_id, choice_id } = req.body;
  if (!run_id || !event_id || !choice_id) {
    return res.status(400).json({ error: 'run_id, event_id, and choice_id are required' });
  }

  try {
    const { rows: runRows } = await query('SELECT * FROM game_runs WHERE id = $1', [run_id]);
    if (!runRows.length) return res.status(404).json({ error: 'Game run not found' });
    if (runRows[0].student_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });

    const run = rowToGameRun(runRows[0]);

    const { rows: choiceRows } = await query(
      'SELECT * FROM event_choices WHERE id = $1 AND event_id = $2',
      [choice_id, event_id]
    );
    if (!choiceRows.length) return res.status(404).json({ error: 'Choice not found' });

    const { rows: eventRows } = await query(
      'SELECT * FROM decision_events WHERE id = $1', [event_id]
    );
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' });

    // Get student's research_uuid for log entry
    const { rows: studentRows } = await query(
      'SELECT research_uuid FROM students WHERE id = $1', [req.user.sub]
    );
    const researchUuid = studentRows[0]?.research_uuid;
    const archetypes = await getArchetypes(researchUuid);

    const choice = { ...choiceRows[0], stat_deltas: choiceRows[0].stat_deltas ?? {} };
    const { updatedRun, logEntry } = engine.resolveChoice(run, eventRows[0], choice, archetypes);

    // Persist updates in a transaction
    await transaction(async (client) => {
      await client.query(
        `UPDATE game_runs SET
           stat_academic   = $1,
           stat_financial  = $2,
           stat_work_ethic = $3,
           stat_social     = $4,
           updated_at      = now()
         WHERE id = $5`,
        [
          updatedRun.stats.academic,
          updatedRun.stats.financial,
          updatedRun.stats.work_ethic,
          updatedRun.stats.social,
          run_id,
        ]
      );

      await client.query(
        `INSERT INTO game_event_log
           (research_uuid, game_run_id, event_id, choice_id, stats_before, stats_after)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          researchUuid,
          run_id,
          event_id,
          choice_id,
          JSON.stringify(logEntry.stats_before),
          JSON.stringify(logEntry.stats_after),
        ]
      );

      // Record choice in active class session for ripple evaluation
      await client.query(
        `UPDATE class_sessions
         SET pending_choices = pending_choices || $1::jsonb,
             choices_submitted = choices_submitted + 1
         WHERE class_id = $2 AND closed_at IS NULL`,
        [JSON.stringify({ [req.user.sub]: choice_id }), run.class_id]
      );
    });

    return res.json({
      stats: updatedRun.stats,
      outcome_text: choiceRows[0].outcome_text,
    });
  } catch (err) {
    console.error('[game/event/choice]', err);
    return res.status(500).json({ error: 'Failed to process choice' });
  }
});

// ─── GET /game/paths ──────────────────────────────────────────────────────────

router.get('/paths', async (req, res) => {
  const { run_id } = req.query;
  if (!run_id) return res.status(400).json({ error: 'run_id is required' });

  try {
    const { rows } = await query('SELECT * FROM game_runs WHERE id = $1', [run_id]);
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    if (rows[0].student_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });

    const run = rowToGameRun(rows[0]);
    const paths = engine.getAvailablePaths(run);
    const score = engine.computeOpportunityScore(run.stats, 'high_school');

    return res.json({ paths, opportunity_score: Math.round(score * 10) / 10 });
  } catch (err) {
    console.error('[game/paths]', err);
    return res.status(500).json({ error: 'Failed to compute available paths' });
  }
});

// ─── POST /game/phase/advance ─────────────────────────────────────────────────

router.post('/phase/advance', async (req, res) => {
  const { run_id, next_phase, path_id } = req.body;
  if (!run_id || !next_phase) {
    return res.status(400).json({ error: 'run_id and next_phase are required' });
  }

  try {
    const { rows } = await query('SELECT * FROM game_runs WHERE id = $1', [run_id]);
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    if (rows[0].student_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });

    const run = rowToGameRun(rows[0]);
    const updatedRun = engine.advancePhase(run, next_phase, path_id);

    await query(
      `UPDATE game_runs SET phase = $1, path_id = $2, updated_at = now() WHERE id = $3`,
      [updatedRun.phase, updatedRun.path_id ?? null, run_id]
    );

    return res.json({ phase: updatedRun.phase, path_id: updatedRun.path_id });
  } catch (err) {
    if (err.message?.includes('Invalid phase') || err.message?.includes('not available')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[game/phase/advance]', err);
    return res.status(500).json({ error: 'Failed to advance phase' });
  }
});

// ─── GET /game/budget ─────────────────────────────────────────────────────────

router.get('/budget', async (req, res) => {
  const { run_id, career_code, retirement_pct } = req.query;
  if (!run_id) return res.status(400).json({ error: 'run_id is required' });

  try {
    const { rows: runRows } = await query('SELECT * FROM game_runs WHERE id = $1', [run_id]);
    if (!runRows.length) return res.status(404).json({ error: 'Run not found' });
    if (runRows[0].student_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });

    const run = rowToGameRun(runRows[0]);

    // Fetch occupation from the class snapshot
    const { rows: classRows } = await query(
      'SELECT snapshot_id FROM classes WHERE id = $1', [run.class_id]
    );
    const snapshotId = classRows[0]?.snapshot_id;

    const socCode = career_code ?? run.career_code;
    const { rows: occRows } = await query(
      `SELECT * FROM snapshot_occupations WHERE snapshot_id = $1 AND soc_code = $2`,
      [snapshotId, socCode]
    );

    if (!occRows.length) return res.status(404).json({ error: 'Occupation not found in snapshot' });

    // Fetch cost-of-living from snapshot
    const { rows: costRows } = await query(
      'SELECT * FROM snapshot_costs WHERE snapshot_id = $1', [snapshotId]
    );
    if (!costRows.length) return res.status(404).json({ error: 'Snapshot costs not found' });

    const costs = costRows[0];
    const pathTuition = {
      trade_school:       costs.tuition_trade_school,
      community_college:  costs.tuition_community_college,
      state_university:   costs.tuition_state_university,
      private_university: costs.tuition_private_university,
      ivy_league:         costs.tuition_ivy_league,
    };

    const costsForEngine = {
      median_rent:       parseFloat(costs.median_rent_1br ?? 1200),
      monthly_groceries: parseFloat(costs.monthly_groceries ?? 400),
      monthly_transport: parseFloat(costs.monthly_transport ?? 350),
      monthly_utilities: parseFloat(costs.monthly_utilities ?? 150),
      monthly_healthcare: parseFloat(costs.monthly_healthcare ?? 200),
      tuition_total:     parseFloat(pathTuition[run.path_id] ?? 0),
    };

    const budget = engine.computeMonthlyBudget(
      run,
      { median_annual_wage: parseFloat(occRows[0].median_annual_wage) },
      costsForEngine,
      { retirement_pct: retirement_pct ? parseFloat(retirement_pct) : 0.05 }
    );

    return res.json({ budget });
  } catch (err) {
    console.error('[game/budget]', err);
    return res.status(500).json({ error: 'Failed to compute budget' });
  }
});

// ─── GET /game/outcome ────────────────────────────────────────────────────────

router.get('/outcome', async (req, res) => {
  const { run_id } = req.query;
  if (!run_id) return res.status(400).json({ error: 'run_id is required' });

  try {
    const { rows } = await query('SELECT * FROM game_runs WHERE id = $1', [run_id]);
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    if (rows[0].student_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });

    const run = rowToGameRun(rows[0]);

    // Fetch occupation
    const { rows: classRows } = await query(
      'SELECT snapshot_id FROM classes WHERE id = $1', [run.class_id]
    );
    const { rows: occRows } = await query(
      `SELECT * FROM snapshot_occupations WHERE snapshot_id = $1 AND soc_code = $2`,
      [classRows[0]?.snapshot_id, run.career_code]
    );

    const outcome = engine.computeOutcome(run, occRows[0] ?? {});

    // Persist final score
    await query(
      `UPDATE game_runs SET final_score = $1, is_complete = true, updated_at = now() WHERE id = $2`,
      [outcome.total_score, run_id]
    );

    return res.json({ outcome });
  } catch (err) {
    console.error('[game/outcome]', err);
    return res.status(500).json({ error: 'Failed to compute outcome' });
  }
});

module.exports = router;
