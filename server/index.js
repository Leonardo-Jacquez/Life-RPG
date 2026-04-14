'use strict';

require('dotenv').config({ path: '../.env' });

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const cookieParser = require('cookie-parser');
const { standard } = require('./middleware/rateLimit');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(standard);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/auth',     require('./routes/auth'));
app.use('/game',     require('./routes/game'));
app.use('/game/run', require('./routes/character'));
app.use('/teacher',  require('./routes/teacher'));
app.use('/snapshot', require('./routes/snapshot'));
app.use('/research', require('./routes/research'));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[server error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────

const server = http.createServer(app);
require('./services/websocket').setup(server);

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => {
  console.log(`Life-RPG server running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
});

module.exports = app;
