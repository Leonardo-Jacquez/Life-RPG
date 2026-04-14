// Thin API client — wraps fetch with auth headers and JSON parsing.

const BASE = '';  // proxied by Vite dev server; empty string works for same-origin

function getToken() {
  return localStorage.getItem('life_rpg_token');
}

export function setToken(token) {
  localStorage.setItem('life_rpg_token', token);
}

export function clearToken() {
  localStorage.removeItem('life_rpg_token');
}

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  get:    (path)        => request('GET', path),
  post:   (path, body)  => request('POST', path, body),
  patch:  (path, body)  => request('PATCH', path, body),
  delete: (path)        => request('DELETE', path),
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  classCode: (classCode, displayUsername) =>
    api.post('/auth/class-code', { class_code: classCode, display_username: displayUsername }),
  logout: () => { clearToken(); return api.post('/auth/logout'); },
};

// ─── Game ─────────────────────────────────────────────────────────────────────

export const game = {
  getActiveRun:  (classId)                        => api.get(`/game/run/active?class_id=${classId}`),
  getRuns:       (classId)                        => api.get(`/game/runs?class_id=${classId}`),
  nextEvent:     (runId)                          => api.get(`/game/event/next?run_id=${runId}`),
  submitChoice:  (runId, eventId, choiceId)       => api.post('/game/event/choice', { run_id: runId, event_id: eventId, choice_id: choiceId }),
  getPaths:      (runId)                          => api.get(`/game/paths?run_id=${runId}`),
  advancePhase:  (runId, nextPhase, pathId)       => api.post('/game/phase/advance', { run_id: runId, next_phase: nextPhase, path_id: pathId }),
  getBudget:     (runId, careerCode, retirePct)   => api.get(`/game/budget?run_id=${runId}&career_code=${careerCode}&retirement_pct=${retirePct ?? 0.05}`),
  getOutcome:    (runId)                          => api.get(`/game/outcome?run_id=${runId}`),
};

// ─── Teacher ─────────────────────────────────────────────────────────────────

export const teacher = {
  getClasses:        ()            => api.get('/teacher/classes'),
  createClass:       (name)        => api.post('/teacher/classes', { name }),
  getStudents:       (classId)     => api.get(`/teacher/classes/${classId}/students`),
  getSession:        (classId)     => api.get(`/teacher/classes/${classId}/session`),
  openSession:       (classId, eventId) => api.post(`/teacher/classes/${classId}/session`, { event_id: eventId }),
  closeSession:      (classId)     => api.post(`/teacher/classes/${classId}/session/close`),
  getLeaderboard:    (classId)     => api.get(`/teacher/classes/${classId}/leaderboard`),
  setVisibility:     (classId, v)  => api.patch(`/teacher/classes/${classId}/visibility`, { visibility: v }),
};

// ─── Snapshot ────────────────────────────────────────────────────────────────

export const snapshot = {
  get:          (classId)               => api.get(`/snapshot/${classId}`),
  pull:         (classId, label)        => api.post(`/snapshot/${classId}/pull`, { label }),
  lock:         (classId, snapshotId)   => api.post(`/snapshot/${classId}/lock`, { snapshot_id: snapshotId }),
  occupations:  (classId, params = {})  => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/snapshot/${classId}/occupations?${qs}`);
  },
};
