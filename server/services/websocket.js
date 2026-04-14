'use strict';

// WebSocket service for live teacher view.
//
// Connection flow:
//   1. Client connects with ?token=<JWT>
//   2. Server verifies JWT and registers client in the appropriate room
//   3. Server broadcasts class state updates when students submit choices

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Rooms: Map<classId, Set<{ ws, role, userId }>>
const rooms = new Map();

function getRoomOrCreate(classId) {
  if (!rooms.has(classId)) rooms.set(classId, new Set());
  return rooms.get(classId);
}

function broadcast(classId, data) {
  const room = rooms.get(classId);
  if (!room) return;
  const payload = JSON.stringify(data);
  for (const client of room) {
    if (client.ws.readyState === 1 /* OPEN */) {
      client.ws.send(payload);
    }
  }
}

/**
 * Broadcast an updated class stats summary to all clients in a room.
 * Used after a student submits a choice — teacher sees live stat movement.
 */
function broadcastClassUpdate(classId, payload) {
  broadcast(classId, { type: 'CLASS_UPDATE', ...payload });
}

/**
 * Broadcast a ripple event to all affected students in a class.
 */
function broadcastRipple(classId, rippleResult) {
  broadcast(classId, { type: 'RIPPLE', ...rippleResult });
}

function setup(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET);
    } catch {
      ws.close(4002, 'Invalid token');
      return;
    }

    const classId = url.searchParams.get('class_id') ?? decoded.classId;
    if (!classId) {
      ws.close(4003, 'Missing class_id');
      return;
    }

    const client = { ws, role: decoded.role, userId: decoded.sub };
    const room = getRoomOrCreate(classId);
    room.add(client);

    ws.on('close', () => room.delete(client));

    ws.on('error', (err) => {
      console.error('[ws] Client error:', err.message);
      room.delete(client);
    });

    // Acknowledge connection
    ws.send(JSON.stringify({ type: 'CONNECTED', classId }));
  });

  return wss;
}

module.exports = { setup, broadcastClassUpdate, broadcastRipple };
