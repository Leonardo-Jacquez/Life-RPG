'use strict';

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

/**
 * Middleware: verify JWT bearer token, attach decoded payload to req.user.
 * Token shape: { sub: userId, role: 'student'|'teacher', classId?, iat, exp }
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, SECRET || 'dev_secret_change_me');
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: message });
  }
}

/**
 * Middleware: require the authenticated user to have the 'teacher' role.
 * Must be used after requireAuth.
 */
function requireTeacher(req, res, next) {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }
  next();
}

/**
 * Middleware: require the authenticated user to have the 'student' role.
 */
function requireStudent(req, res, next) {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ error: 'Student access required' });
  }
  next();
}

/**
 * Sign a new JWT for the given subject/role.
 * @param {{ sub: string, role: string, [key: string]: any }} payload
 */
function signToken(payload) {
  return jwt.sign(payload, SECRET || 'dev_secret_change_me', {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  });
}

module.exports = { requireAuth, requireTeacher, requireStudent, signToken };
