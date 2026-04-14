'use strict';

// POST /game/run/character
// Called at the end of character creation. Stores avatar + psychometric data
// and creates the initial game run if one doesn't already exist.

const express = require('express');
const { query, transaction } = require('../db');
const { requireAuth, requireStudent } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireStudent);

router.post('/character', async (req, res) => {
  const studentId = req.user.sub;
  const { class_id, avatar, archetypes, raw_responses } = req.body;

  if (!class_id) return res.status(400).json({ error: 'class_id is required' });
  if (!avatar)   return res.status(400).json({ error: 'avatar is required' });

  try {
    // Verify student is enrolled in this class
    const { rows: enrollRows } = await query(
      'SELECT id FROM student_enrollments WHERE student_id = $1 AND class_id = $2',
      [studentId, class_id]
    );
    if (!enrollRows.length) {
      return res.status(403).json({ error: 'Not enrolled in this class' });
    }

    // Get student's research_uuid
    const { rows: studentRows } = await query(
      'SELECT research_uuid FROM students WHERE id = $1', [studentId]
    );
    const researchUuid = studentRows[0]?.research_uuid;

    await transaction(async (client) => {
      // Upsert psychometric profile (linked to research_uuid only)
      await client.query(
        `INSERT INTO psychometric_profiles
           (research_uuid, score_O, score_C, score_E, score_A, score_N, score_grit, score_ftp, raw_responses)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (research_uuid) DO UPDATE SET
           score_O = EXCLUDED.score_O, score_C = EXCLUDED.score_C,
           score_E = EXCLUDED.score_E, score_A = EXCLUDED.score_A,
           score_N = EXCLUDED.score_N, score_grit = EXCLUDED.score_grit,
           score_ftp = EXCLUDED.score_ftp, raw_responses = EXCLUDED.raw_responses`,
        [
          researchUuid,
          archetypes?.O  ?? 0.5,
          archetypes?.C  ?? 0.5,
          archetypes?.E  ?? 0.5,
          archetypes?.A  ?? 0.5,
          archetypes?.N  ?? 0.5,
          archetypes?.grit ?? 0.5,
          archetypes?.ftp  ?? 0.5,
          JSON.stringify(raw_responses ?? {}),
        ]
      );

      // Count existing runs
      const { rows: countRows } = await client.query(
        'SELECT COUNT(*) AS cnt FROM game_runs WHERE student_id = $1 AND class_id = $2',
        [studentId, class_id]
      );
      const runNumber = parseInt(countRows[0].cnt) + 1;

      // Create new run with character_prefs
      await client.query(
        `INSERT INTO game_runs (student_id, class_id, run_number, character_prefs)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, class_id, run_number) DO UPDATE SET
           character_prefs = EXCLUDED.character_prefs`,
        [studentId, class_id, runNumber, JSON.stringify({ avatar, archetypes })]
      );
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[character POST]', err);
    return res.status(500).json({ error: 'Failed to save character' });
  }
});

module.exports = router;
