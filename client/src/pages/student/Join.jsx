import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, setToken } from '../../api/client.js';

export default function Join() {
  const navigate = useNavigate();
  const [classCode, setClassCode] = useState('');
  const [username, setUsername]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    if (!classCode.trim() || !username.trim()) {
      setError('Both fields are required.');
      return;
    }
    setLoading(true);
    try {
      const data = await auth.classCode(classCode.trim().toUpperCase(), username.trim());
      setToken(data.token);
      localStorage.setItem('life_rpg_role', 'student');
      localStorage.setItem('life_rpg_class_id', data.classId);
      // Check if character creation is needed
      navigate('/student/create');
    } catch (err) {
      setError(err.message ?? 'Failed to join. Check your class code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center' }}>
      <div className="card">
        <div className="title-block">
          <h1>Life RPG</h1>
          <p>Enter your class code to begin your life simulation.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label>Class Code</label>
            <input
              value={classCode}
              onChange={e => setClassCode(e.target.value.toUpperCase())}
              placeholder="e.g. XKQT9A"
              maxLength={6}
              autoComplete="off"
              style={{ letterSpacing: '0.2em', fontWeight: 700, fontSize: '1.2rem' }}
            />
          </div>
          <div className="form-group">
            <label>Pick a username (no real name required)</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. ShadowFox42"
              maxLength={30}
              autoComplete="off"
            />
          </div>
          <button className="btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Joining…' : 'Join Class'}
          </button>
        </form>

        <div className="spacer" />
        <p className="text-center text-muted" style={{ fontSize: '0.8rem' }}>
          No account or password required. Your teacher will give you a class code.
        </p>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a
            href="/teacher/login"
            style={{ color: 'var(--accent-light)', fontSize: '0.875rem' }}
          >
            Are you a teacher? Sign in here →
          </a>
        </div>
      </div>
    </div>
  );
}
