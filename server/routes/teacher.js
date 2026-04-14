'use strict';

// Teacher dashboard routes:
//   GET  /teacher/classes                 — list teacher's classes
//   POST /teacher/classes                 — create a class
//   GET  /teacher/classes/:id/students    — list students + live stats
//   GET  /teacher/classes/:id/session     — get active session state
//   POST /teacher/classes/:id/session     — open a new session for an event
//   POST /teacher/classes/:id/session/close — close session + evaluate ripple
//   GET  /teacher/classes/:id/leaderboard — final score board
//   PATCH /teacher/classes/:id/visibility — update visibility tier

const express = require('express');
const { query, transaction } = require('../db');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { standard } = require('../middleware/rateLimit');
const engine = require('@life-rpg/engine');

const router = express.Router();
router.use(requireAuth, requireTeacher, standard);

// ─── GET /teacher/classes ─────────────────────────────────────────────────────

router.get('/classes', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*, ss.label AS snapshot_label, ss.locked_at AS snapshot_locked_at,
              COUNT(se.id) AS student_count
       FROM classes c
       LEFT JOIN semester_snapshots ss ON ss.id = c.snapshot_id
       LEFT JOIN student_enrollments se ON se.class_id = c.id
       WHERE c.teacher_id = $1
       GROUP BY c.id, ss.label, ss.locked_at
       ORDER BY c.created_at DESC`,
      [req.user.sub]
    );
    return res.json({ classes: rows });
  } catch (err) {
    console.error('[teacher/classes]', err);
    return res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// ─── POST /teacher/classes ────────────────────────────────────────────────────

router.post('/classes', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Class name is required' });

  // Generate a random 6-char alphanumeric class code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const classCode = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');

  try {
    const { rows } = await query(
      `INSERT INTO classes (teacher_id, name, class_code)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.sub, name.trim(), classCode]
    );
    return res.status(201).json({ class: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      // Duplicate class code — extremely rare, retry
      return res.status(409).json({ error: 'Code collision, please try again' });
    }
    console.error('[teacher/classes POST]', err);
    return res.status(500).json({ error: 'Failed to create class' });
  }
});

// ─── GET /teacher/classes/:id/students ───────────────────────────────────────

router.get('/classes/:id/students', async (req, res) => {
  const classId = req.params.id;

  try {
    // Verify teacher owns this class
    const { rows: classRows } = await query(
      'SELECT id, visibility FROM classes WHERE id = $1 AND teacher_id = $2',
      [classId, req.user.sub]
    );
    if (!classRows.length) return res.status(404).json({ error: 'Class not found' });

    const { rows } = await query(
      `SELECT s.id, s.display_username,
              gr.run_number, gr.phase, gr.path_id, gr.is_complete,
              gr.stat_academic, gr.stat_financial, gr.stat_work_ethic, gr.stat_social,
              gr.final_score, gr.updated_at
       FROM student_enrollments se
       JOIN students s ON s.id = se.student_id
       LEFT JOIN game_runs gr ON gr.student_id = s.id AND gr.class_id = $1 AND gr.is_complete = false
       WHERE se.class_id = $1
       ORDER BY s.display_username`,
      [classId]
    );

    return res.json({
      students: rows,
      visibility: classRows[0].visibility,
    });
  } catch (err) {
    console.error('[teacher/students]', err);
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// ─── GET /teacher/classes/:id/session ────────────────────────────────────────

router.get('/classes/:id/session', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT cs.*, de.prompt_text, de.phase AS event_phase,
              COUNT(DISTINCT se.student_id) AS total_enrolled
       FROM class_sessions cs
       JOIN classes c ON c.id = cs.class_id
       LEFT JOIN decision_events de ON de.id = cs.current_event_id
       LEFT JOIN student_enrollments se ON se.class_id = cs.class_id
       WHERE cs.class_id = $1 AND c.teacher_id = $2 AND cs.closed_at IS NULL
       GROUP BY cs.id, de.prompt_text, de.phase
       ORDER BY cs.opened_at DESC LIMIT 1`,
      [req.params.id, req.user.sub]
    );
    return res.json({ session: rows[0] ?? null });
  } catch (err) {
    console.error('[teacher/session GET]', err);
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// ─── POST /teacher/classes/:id/session ───────────────────────────────────────

router.post('/classes/:id/session', async (req, res) => {
  const { event_id } = req.body;
  const classId = req.params.id;

  try {
    const { rows: classRows } = await query(
      'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
      [classId, req.user.sub]
    );
    if (!classRows.length) return res.status(404).json({ error: 'Class not found' });

    // Close any open session first
    await query(
      `UPDATE class_sessions SET closed_at = now() WHERE class_id = $1 AND closed_at IS NULL`,
      [classId]
    );

    // Count enrolled students
    const { rows: countRows } = await query(
      'SELECT COUNT(*) AS cnt FROM student_enrollments WHERE class_id = $1',
      [classId]
    );

    const { rows } = await query(
      `INSERT INTO class_sessions (class_id, teacher_id, current_event_id, total_students)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [classId, req.user.sub, event_id ?? null, parseInt(countRows[0].cnt)]
    );
    return res.status(201).json({ session: rows[0] });
  } catch (err) {
    console.error('[teacher/session POST]', err);
    return res.status(500).json({ error: 'Failed to open session' });
  }
});

// ─── POST /teacher/classes/:id/session/close ─────────────────────────────────

router.post('/classes/:id/session/close', async (req, res) => {
  const classId = req.params.id;

  try {
    const { rows: sessionRows } = await query(
      `SELECT cs.* FROM class_sessions cs
       JOIN classes c ON c.id = cs.class_id
       WHERE cs.class_id = $1 AND c.teacher_id = $2 AND cs.closed_at IS NULL
       ORDER BY cs.opened_at DESC LIMIT 1`,
      [classId, req.user.sub]
    );

    if (!sessionRows.length) return res.status(404).json({ error: 'No open session found' });
    const session = sessionRows[0];

    // Fetch all choices for the event
    const { rows: choiceRows } = await query(
      'SELECT * FROM event_choices WHERE event_id = $1',
      [session.current_event_id]
    );

    // Evaluate ripple
    const rippleResult = engine.processRipple(
      { id: session.current_event_id },
      session.pending_choices ?? {},
      choiceRows
    );

    // If ripple fired, persist boosts into each affected student's game run character_prefs
    if (rippleResult.firedRipple) {
      await transaction(async (client) => {
        for (const [studentId, payload] of Object.entries(rippleResult.rippleBoostsByStudent)) {
          await client.query(
            `UPDATE game_runs
             SET character_prefs = jsonb_set(
               character_prefs,
               '{ripple_boosts}',
               COALESCE(character_prefs->'ripple_boosts', '{}') || $1::jsonb
             )
             WHERE student_id = $2 AND class_id = $3 AND is_complete = false`,
            [JSON.stringify(payload), studentId, classId]
          );

          // Mark the log entry as ripple_triggered
          await client.query(
            `UPDATE game_event_log
             SET ripple_triggered = true
             WHERE game_run_id = (
               SELECT id FROM game_runs WHERE student_id = $1 AND class_id = $2 AND is_complete = false LIMIT 1
             )
             AND event_id = $3
             AND choice_id = $4`,
            [studentId, classId, session.current_event_id, rippleResult.dominantChoiceId]
          );
        }
      });
    }

    // Close the session
    await query(
      `UPDATE class_sessions SET closed_at = now() WHERE id = $1`,
      [session.id]
    );

    return res.json({ ripple: rippleResult });
  } catch (err) {
    console.error('[teacher/session/close]', err);
    return res.status(500).json({ error: 'Failed to close session' });
  }
});

// ─── GET /teacher/classes/:id/leaderboard ────────────────────────────────────

router.get('/classes/:id/leaderboard', async (req, res) => {
  const classId = req.params.id;

  try {
    const { rows: classRows } = await query(
      'SELECT visibility FROM classes WHERE id = $1 AND teacher_id = $2',
      [classId, req.user.sub]
    );
    if (!classRows.length) return res.status(404).json({ error: 'Class not found' });

    const { rows } = await query(
      `SELECT gr.id, gr.run_number, gr.final_score, gr.phase, gr.path_id,
              s.display_username
       FROM game_runs gr
       JOIN students s ON s.id = gr.student_id
       WHERE gr.class_id = $1
       ORDER BY gr.final_score DESC NULLS LAST, gr.run_number`,
      [classId]
    );

    // In 'blind' mode teacher still sees all; students see only aggregate
    return res.json({ leaderboard: rows, visibility: classRows[0].visibility });
  } catch (err) {
    console.error('[teacher/leaderboard]', err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ─── PATCH /teacher/classes/:id/visibility ───────────────────────────────────

router.patch('/classes/:id/visibility', async (req, res) => {
  const { visibility } = req.body;
  if (!['blind', 'aggregate', 'open'].includes(visibility)) {
    return res.status(400).json({ error: 'visibility must be blind, aggregate, or open' });
  }

  try {
    const { rows } = await query(
      `UPDATE classes SET visibility = $1 WHERE id = $2 AND teacher_id = $3 RETURNING id, visibility`,
      [visibility, req.params.id, req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'Class not found' });
    return res.json({ visibility: rows[0].visibility });
  } catch (err) {
    console.error('[teacher/visibility]', err);
    return res.status(500).json({ error: 'Failed to update visibility' });
  }
});

module.exports = router;
