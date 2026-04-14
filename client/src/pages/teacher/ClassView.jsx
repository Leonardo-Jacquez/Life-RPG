import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { teacher } from '../../api/client.js';
import StatBar from '../../components/StatBar.jsx';

const VISIBILITY_LABELS = { blind: 'Blind', aggregate: 'Aggregate', open: 'Open Leaderboard' };

const PHASE_COLORS = {
  high_school: 'var(--accent)',
  college:     'var(--blue)',
  adult:       'var(--gold)',
  complete:    'var(--green)',
};

export default function ClassView() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const wsRef     = useRef(null);

  const [students, setStudents]     = useState([]);
  const [session, setSession]       = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [visibility, setVisibility] = useState('aggregate');
  const [tab, setTab]               = useState('live');   // 'live' | 'leaderboard'
  const [liveData, setLiveData]     = useState({});       // { [studentId]: latestStats }
  const [ripple, setRipple]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [studentData, sessionData] = await Promise.all([
          teacher.getStudents(id),
          teacher.getSession(id),
        ]);
        setStudents(studentData.students);
        setVisibility(studentData.visibility);
        setSession(sessionData.session);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (tab === 'leaderboard') {
      teacher.getLeaderboard(id)
        .then(({ leaderboard: lb }) => setLeaderboard(lb))
        .catch(err => setError(err.message));
    }
  }, [tab, id]);

  // ── WebSocket for live student updates ────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('life_rpg_token');
    const ws = new WebSocket(`/ws?token=${token}&class_id=${id}`);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'CLASS_UPDATE') {
        setLiveData(prev => ({ ...prev, [data.studentId]: data.stats }));
        if (data.pendingChoices != null) {
          setSession(prev => prev ? { ...prev, choices_submitted: data.submitted, pending_choices: data.pendingChoices } : prev);
        }
      }
      if (data.type === 'RIPPLE') {
        setRipple(data);
        setTimeout(() => setRipple(null), 8000);
      }
    };

    return () => ws.close();
  }, [id]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleOpenSession() {
    try {
      const { session: s } = await teacher.openSession(id);
      setSession(s);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCloseSession() {
    try {
      const { ripple: r } = await teacher.closeSession(id);
      setSession(null);
      if (r.firedRipple) setRipple(r);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleVisibilityChange(v) {
    try {
      await teacher.setVisibility(id, v);
      setVisibility(v);
    } catch (err) {
      setError(err.message);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getStudentStats(s) {
    // Prefer live WebSocket data; fall back to DB snapshot
    if (liveData[s.id]) return liveData[s.id];
    if (s.stat_academic == null) return null;
    return {
      academic:   s.stat_academic,
      financial:  s.stat_financial,
      work_ethic: s.stat_work_ethic,
      social:     s.stat_social,
    };
  }

  function computeClassAverage() {
    const active = students.filter(s => getStudentStats(s));
    if (!active.length) return null;
    const sum = (key) => active.reduce((n, s) => n + (getStudentStats(s)?.[key] ?? 0), 0);
    return {
      academic:   Math.round(sum('academic') / active.length),
      financial:  Math.round(sum('financial') / active.length),
      work_ethic: Math.round(sum('work_ethic') / active.length),
      social:     Math.round(sum('social') / active.length),
    };
  }

  const classAvg = computeClassAverage();
  const submitted = session?.choices_submitted ?? 0;
  const total     = session?.total_students ?? 0;

  if (loading) return <div className="page" style={{ justifyContent: 'center' }}><p>Loading class…</p></div>;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <button className="btn-secondary" onClick={() => navigate('/teacher')} style={{ marginBottom: 8 }}>
            ← Dashboard
          </button>
          <h2 style={{ margin: 0 }}>{students.length} student{students.length !== 1 ? 's' : ''} enrolled</h2>
        </div>
        <div className="btn-row" style={{ margin: 0, flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            onClick={() => navigate(`/teacher/class/${id}/snapshot`)}
          >
            Manage Snapshot
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ width: '100%', maxWidth: 900 }}>{error}</div>}

      {/* Ripple alert */}
      {ripple?.firedRipple && (
        <div className="ripple-banner" style={{ width: '100%', maxWidth: 900, marginBottom: 16 }}>
          <strong style={{ color: 'var(--gold)' }}>Ripple Fired!</strong>{' '}
          {Math.round((ripple.dominantPct ?? 0) * 100)}% of class made the same choice.
          Probability weights are shifting for {Object.keys(ripple.rippleBoostsByStudent ?? {}).length} students.
        </div>
      )}

      {/* Controls row */}
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Visibility */}
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.entries(VISIBILITY_LABELS).map(([v, label]) => (
            <button
              key={v}
              className={visibility === v ? 'btn-primary' : 'btn-secondary'}
              onClick={() => handleVisibilityChange(v)}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Session control */}
        {!session ? (
          <button className="btn-gold" onClick={handleOpenSession}>Open Event Window</button>
        ) : (
          <button className="btn-danger" onClick={handleCloseSession}>
            Close &amp; Evaluate ({submitted}/{total} submitted)
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', gap: 8, marginBottom: 16 }}>
        {['live', 'leaderboard'].map(t => (
          <button
            key={t}
            className={tab === t ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab(t)}
            style={{ textTransform: 'capitalize' }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Class average (always shown) */}
      {classAvg && visibility !== 'blind' && (
        <div className="card card-wide" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Class Average</h3>
          <StatBar stats={classAvg} />
        </div>
      )}

      {/* Live tab */}
      {tab === 'live' && (
        <div className="card card-wide">
          <table className="student-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Phase</th>
                <th>Academic</th>
                <th>Work Ethic</th>
                <th>Financial</th>
                <th>Social</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const stats = getStudentStats(s);
                return (
                  <tr key={s.id}>
                    <td>
                      {visibility === 'open' ? s.display_username : `Student #${s.id.slice(-4)}`}
                    </td>
                    <td>
                      <span style={{
                        color: PHASE_COLORS[s.phase] ?? 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        textTransform: 'capitalize',
                      }}>
                        {(s.phase ?? 'not started').replace('_', ' ')}
                      </span>
                    </td>
                    {stats ? (
                      <>
                        <td>{Math.round(stats.academic)}</td>
                        <td>{Math.round(stats.work_ethic)}</td>
                        <td>{Math.round(stats.financial)}</td>
                        <td>{Math.round(stats.social)}</td>
                      </>
                    ) : (
                      <td colSpan={4} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Not started
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        <div className="card card-wide">
          <table className="student-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Path</th>
                <th>Run</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, i) => (
                <tr key={row.id}>
                  <td style={{ color: i === 0 ? 'var(--gold)' : 'var(--text-muted)', fontWeight: 700 }}>
                    {i + 1}
                  </td>
                  <td>{visibility === 'open' ? row.display_username : `Student #${row.id.slice(-4)}`}</td>
                  <td style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                    {(row.path_id ?? '—').replace('_', ' ')}
                  </td>
                  <td>{row.run_number}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-light)' }}>
                    {row.final_score ?? '—'}
                  </td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No completed runs yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
