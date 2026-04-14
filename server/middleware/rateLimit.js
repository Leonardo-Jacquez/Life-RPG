'use strict';

const rateLimit = require('express-rate-limit');

/** Standard rate limit: 100 req/15min per IP */
const standard = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/** Strict rate limit for auth endpoints: 20 req/15min per IP */
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

/** Generous limit for game events (students submit choices rapidly) */
const gameLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down! Too many game actions.' },
});

module.exports = { standard, authLimit, gameLimit };
