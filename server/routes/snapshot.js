'use strict';

// Semester snapshot management routes:
//   GET  /snapshot/:classId            — get active snapshot for class
//   POST /snapshot/:classId/pull       — trigger data pull (teacher only)
//   POST /snapshot/:classId/lock       — lock snapshot (teacher only, irreversible)
//   GET  /snapshot/:classId/occupations — list careers (with search/filter)

const express = require('express');
const { query, transaction } = require('../db');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { standard } = require('../middleware/rateLimit');
const snapshotService = require('../services/snapshot');

const router = express.Router();

// ─── GET /snapshot/:classId ───────────────────────────────────────────────────

router.get('/:classId', requireAuth, standard, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ss.*, sc.monthly_groceries, sc.median_rent_1br, sc.monthly_transport,
              sc.federal_loan_rate_pct,
              COUNT(so.id) AS occupation_count
       FROM semester_snapshots ss
       JOIN classes c ON c.snapshot_id = ss.id
       LEFT JOIN snapshot_costs sc ON sc.snapshot_id = ss.id
       LEFT JOIN snapshot_occupations so ON so.snapshot_id = ss.id
       WHERE c.id = $1
       GROUP BY ss.id, sc.id`,
      [req.params.classId]
    );
    return res.json({ snapshot: rows[0] ?? null });
  } catch (err) {
    console.error('[snapshot GET]', err);
    return res.status(500).json({ error: 'Failed to fetch snapshot' });
  }
});

// ─── POST /snapshot/:classId/pull ────────────────────────────────────────────

router.post('/:classId/pull', requireAuth, requireTeacher, standard, async (req, res) => {
  const classId = req.params.classId;
  const { label } = req.body;

  if (!label?.trim()) return res.status(400).json({ error: 'label is required (e.g. "Fall 2025")' });

  try {
    // Verify teacher owns this class
    const { rows: classRows } = await query(
      'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
      [classId, req.user.sub]
    );
    if (!classRows.length) return res.status(404).json({ error: 'Class not found' });

    // Create a draft snapshot
    const { rows: snapRows } = await query(
      `INSERT INTO semester_snapshots (class_id, label, pulled_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_id, label) DO NOTHING
       RETURNING id`,
      [classId, label.trim(), req.user.sub]
    );

    if (!snapRows.length) {
      return res.status(409).json({ error: 'A snapshot with this label already exists' });
    }

    const snapshotId = snapRows[0].id;

    // Pull external data asynchronously — return immediately, poll for status
    snapshotService.pullAll(snapshotId).catch(err => {
      console.error(`[snapshot/pull] Failed for snapshot ${snapshotId}:`, err);
    });

    return res.status(202).json({
      snapshot_id: snapshotId,
      message: 'Data pull initiated. The snapshot will be ready to lock once all sources respond.',
    });
  } catch (err) {
    console.error('[snapshot/pull]', err);
    return res.status(500).json({ error: 'Failed to initiate snapshot pull' });
  }
});

// ─── POST /snapshot/:classId/lock ────────────────────────────────────────────

router.post('/:classId/lock', requireAuth, requireTeacher, standard, async (req, res) => {
  const { snapshot_id } = req.body;
  if (!snapshot_id) return res.status(400).json({ error: 'snapshot_id is required' });

  try {
    const { rows: snapRows } = await query(
      `SELECT ss.id, ss.locked_at FROM semester_snapshots ss
       JOIN classes c ON c.id = ss.class_id
       WHERE ss.id = $1 AND c.id = $2 AND c.teacher_id = $3`,
      [snapshot_id, req.params.classId, req.user.sub]
    );
    if (!snapRows.length) return res.status(404).json({ error: 'Snapshot not found' });
    if (snapRows[0].locked_at) return res.status(409).json({ error: 'Snapshot is already locked' });

    // Verify snapshot has occupation and cost data
    const { rows: occCheck } = await query(
      'SELECT COUNT(*) AS cnt FROM snapshot_occupations WHERE snapshot_id = $1',
      [snapshot_id]
    );
    if (parseInt(occCheck[0].cnt) === 0) {
      return res.status(400).json({ error: 'Cannot lock snapshot — no occupation data yet. Wait for pull to complete.' });
    }

    await transaction(async (client) => {
      await client.query(
        `UPDATE semester_snapshots SET locked_at = now() WHERE id = $1`,
        [snapshot_id]
      );
      await client.query(
        `UPDATE classes SET snapshot_id = $1 WHERE id = $2`,
        [snapshot_id, req.params.classId]
      );
    });

    return res.json({ ok: true, message: 'Snapshot locked. Students will now query this data.' });
  } catch (err) {
    console.error('[snapshot/lock]', err);
    return res.status(500).json({ error: 'Failed to lock snapshot' });
  }
});

// ─── GET /snapshot/:classId/occupations ──────────────────────────────────────

router.get('/:classId/occupations', requireAuth, standard, async (req, res) => {
  const { search, min_wage, max_wage, education, limit = 50, offset = 0 } = req.query;

  try {
    const { rows: classRows } = await query(
      'SELECT snapshot_id FROM classes WHERE id = $1',
      [req.params.classId]
    );
    if (!classRows[0]?.snapshot_id) {
      return res.status(404).json({ error: 'No locked snapshot for this class' });
    }

    const conditions = ['so.snapshot_id = $1'];
    const params = [classRows[0].snapshot_id];
    let idx = 2;

    if (search) {
      conditions.push(`(so.title ILIKE $${idx} OR so.soc_code = $${idx + 1})`);
      params.push(`%${search}%`, search);
      idx += 2;
    }
    if (min_wage) { conditions.push(`so.median_annual_wage >= $${idx++}`); params.push(min_wage); }
    if (max_wage) { conditions.push(`so.median_annual_wage <= $${idx++}`); params.push(max_wage); }
    if (education) { conditions.push(`so.typical_education ILIKE $${idx++}`); params.push(`%${education}%`); }

    const whereClause = conditions.join(' AND ');
    const { rows } = await query(
      `SELECT * FROM snapshot_occupations so
       WHERE ${whereClause}
       ORDER BY so.median_annual_wage DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Math.min(200, parseInt(limit)), parseInt(offset)]
    );

    return res.json({ occupations: rows });
  } catch (err) {
    console.error('[snapshot/occupations]', err);
    return res.status(500).json({ error: 'Failed to fetch occupations' });
  }
});

module.exports = router;
