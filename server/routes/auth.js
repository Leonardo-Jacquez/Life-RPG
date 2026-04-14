'use strict';

// Auth routes:
//   POST /auth/google/callback  — Google OAuth for teachers + students
//   POST /auth/clever/callback  — Clever SSO for teachers + students
//   POST /auth/class-code       — class-code fallback for students (no SSO required)
//   POST /auth/refresh          — refresh a JWT
//   POST /auth/logout           — invalidate session (client-side only for JWTs)

const express = require('express');
const { query } = require('../db');
const { signToken } = require('../middleware/auth');
const { authLimit } = require('../middleware/rateLimit');

const router = express.Router();

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.post('/google/callback', authLimit, async (req, res) => {
  const { id_token, role } = req.body;
  if (!id_token || !role) {
    return res.status(400).json({ error: 'id_token and role are required' });
  }

  // Verify the Google ID token (in production, use google-auth-library)
  // For now we decode without verification as a placeholder — replace before go-live.
  let googlePayload;
  try {
    const [, payloadB64] = id_token.split('.');
    googlePayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  } catch {
    return res.status(400).json({ error: 'Invalid Google ID token format' });
  }

  const { sub: googleSub, email, name } = googlePayload;
  if (!googleSub) return res.status(400).json({ error: 'Could not extract Google subject from token' });

  try {
    if (role === 'teacher') {
      let { rows } = await query(
        'SELECT id FROM teachers WHERE google_sub = $1', [googleSub]
      );

      if (rows.length === 0) {
        // Auto-provision new teacher
        const result = await query(
          `INSERT INTO teachers (display_name, email, google_sub)
           VALUES ($1, $2, $3) RETURNING id`,
          [name ?? email, email, googleSub]
        );
        rows = result.rows;
      }

      const token = signToken({ sub: rows[0].id, role: 'teacher' });
      return res.json({ token, role: 'teacher' });
    }

    if (role === 'student') {
      let { rows } = await query(
        'SELECT id, research_uuid FROM students WHERE google_sub = $1', [googleSub]
      );

      if (rows.length === 0) {
        const result = await query(
          `INSERT INTO students (display_username, google_sub)
           VALUES ($1, $2) RETURNING id, research_uuid`,
          [name ?? 'Student', googleSub]
        );
        rows = result.rows;
      }

      const token = signToken({ sub: rows[0].id, role: 'student' });
      return res.json({ token, role: 'student' });
    }

    return res.status(400).json({ error: 'Invalid role' });
  } catch (err) {
    console.error('[auth/google]', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// ─── Clever SSO ───────────────────────────────────────────────────────────────

router.post('/clever/callback', authLimit, async (req, res) => {
  // Clever tokens are exchanged server-to-server using the authorization code.
  // Full implementation requires the Clever SDK — this is the structural scaffold.
  const { code, role } = req.body;
  if (!code || !role) {
    return res.status(400).json({ error: 'code and role are required' });
  }

  // TODO: Exchange code for Clever access token, fetch /me, upsert user
  return res.status(501).json({ error: 'Clever SSO not yet implemented' });
});

// ─── Class code (student fallback) ───────────────────────────────────────────

router.post('/class-code', authLimit, async (req, res) => {
  const { class_code, display_username } = req.body;

  if (!class_code || typeof class_code !== 'string') {
    return res.status(400).json({ error: 'class_code is required' });
  }

  const username = (display_username ?? '').trim().slice(0, 30);
  if (!username) {
    return res.status(400).json({ error: 'display_username is required' });
  }

  try {
    const { rows: classRows } = await query(
      'SELECT id FROM classes WHERE class_code = $1 AND active = true',
      [class_code.toUpperCase()]
    );

    if (classRows.length === 0) {
      return res.status(404).json({ error: 'Class code not found or class is inactive' });
    }

    // Create an anonymous student account — no password, no email
    const { rows: studentRows } = await query(
      `INSERT INTO students (display_username) VALUES ($1) RETURNING id`,
      [username]
    );

    const studentId = studentRows[0].id;
    const classId   = classRows[0].id;

    // Enroll the student
    await query(
      `INSERT INTO student_enrollments (student_id, class_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [studentId, classId]
    );

    const token = signToken({ sub: studentId, role: 'student', classId });
    return res.json({ token, role: 'student', classId });
  } catch (err) {
    console.error('[auth/class-code]', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────

// JWT logout is client-side (discard token). Server logs for auditing only.
router.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

module.exports = router;
