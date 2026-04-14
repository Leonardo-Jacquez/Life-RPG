'use strict';

// Research data export routes (requires RESEARCH_EXPORT_SECRET):
//   GET /research/export/events    — anonymized event log (research_uuid only)
//   GET /research/export/psychometric — OCEAN + grit profiles
//   GET /research/export/outcomes  — final game scores per life run

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// All research routes require a separate static secret (not a JWT).
// This is intentionally separate from teacher auth to allow university API access.
function requireResearchSecret(req, res, next) {
  const provided = req.headers['x-research-secret'];
  const expected = process.env.RESEARCH_EXPORT_SECRET;

  if (!expected) return res.status(503).json({ error: 'Research exports not configured' });
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid research secret' });
  }
  next();
}

// ─── GET /research/export/events ─────────────────────────────────────────────

router.get('/export/events', requireResearchSecret, async (req, res) => {
  const { from, to, limit = 1000, offset = 0 } = req.query;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (from) { conditions.push(`logged_at >= $${idx++}`); params.push(from); }
  if (to)   { conditions.push(`logged_at <= $${idx++}`); params.push(to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await query(
      `SELECT
         research_uuid,
         event_id,
         choice_id,
         stats_before,
         stats_after,
         ripple_triggered,
         class_choice_pct,
         logged_at
       FROM game_event_log
       ${where}
       ORDER BY logged_at
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Math.min(10000, parseInt(limit)), parseInt(offset)]
    );

    // Never include game_run_id or any identifier that could link to student.id
    res.setHeader('Content-Type', 'application/json');
    return res.json({ count: rows.length, events: rows });
  } catch (err) {
    console.error('[research/events]', err);
    return res.status(500).json({ error: 'Export failed' });
  }
});

// ─── GET /research/export/psychometric ───────────────────────────────────────

router.get('/export/psychometric', requireResearchSecret, async (req, res) => {
  const { limit = 1000, offset = 0 } = req.query;

  try {
    const { rows } = await query(
      `SELECT research_uuid, score_O, score_C, score_E, score_A, score_N,
              score_grit, score_ftp, created_at
       FROM psychometric_profiles
       ORDER BY created_at
       LIMIT $1 OFFSET $2`,
      [Math.min(10000, parseInt(limit)), parseInt(offset)]
    );

    return res.json({ count: rows.length, profiles: rows });
  } catch (err) {
    console.error('[research/psychometric]', err);
    return res.status(500).json({ error: 'Export failed' });
  }
});

// ─── GET /research/export/outcomes ───────────────────────────────────────────

router.get('/export/outcomes', requireResearchSecret, async (req, res) => {
  const { limit = 1000, offset = 0 } = req.query;

  try {
    // Join via research_uuid only — never expose student.id
    const { rows } = await query(
      `SELECT
         s.research_uuid,
         gr.run_number,
         gr.phase,
         gr.path_id,
         gr.stat_academic,
         gr.stat_financial,
         gr.stat_work_ethic,
         gr.stat_social,
         gr.net_worth,
         gr.final_score,
         gr.is_complete,
         gr.created_at,
         gr.updated_at
       FROM game_runs gr
       JOIN students s ON s.id = gr.student_id
       WHERE s.research_consent_at IS NOT NULL
       ORDER BY gr.created_at
       LIMIT $1 OFFSET $2`,
      [Math.min(10000, parseInt(limit)), parseInt(offset)]
    );

    return res.json({ count: rows.length, outcomes: rows });
  } catch (err) {
    console.error('[research/outcomes]', err);
    return res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
