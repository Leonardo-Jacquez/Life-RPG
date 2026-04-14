import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../../api/client.js';

export default function TeacherLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // In production this kicks off the real Google OAuth2 flow.
  // For dev/demo we simulate it with a mock sign-in.
  async function handleGoogleLogin() {
    setLoading(true);
    setError('');
    try {
      // Production: redirect to /auth/google → Google → /auth/google/callback
      // Dev: POST a mock id_token
      const mockIdToken = btoa(JSON.stringify({ header: 'mock' })) + '.' +
        btoa(JSON.stringify({ sub: 'dev-teacher-001', email: 'teacher@school.edu', name: 'Demo Teacher' })) +
        '.sig';

      const data = await api.post('/auth/google/callback', { id_token: mockIdToken, role: 'teacher' });
      setToken(data.token);
      localStorage.setItem('life_rpg_role', 'teacher');
      navigate('/teacher');
    } catch (err) {
      setError(err.message ?? 'Google sign-in failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center' }}>
      <div className="card">
        <div className="title-block">
          <h1>Life RPG</h1>
          <p>Teacher dashboard — manage your classes and watch your students live.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button
          className="btn-primary btn-full"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <span style={{ fontSize: '1.2rem' }}>G</span>
          {loading ? 'Signing in…' : 'Sign in with Google Classroom'}
        </button>

        <div className="spacer" />

        <button
          className="btn-secondary btn-full"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          Sign in with Clever
        </button>

        <div className="spacer" />
        <p className="text-center text-muted" style={{ fontSize: '0.8rem' }}>
          No account setup needed — your existing Google Classroom or Clever account works.
        </p>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a href="/student/join" style={{ color: 'var(--accent-light)', fontSize: '0.875rem' }}>
            ← Back to student join
          </a>
        </div>
      </div>
    </div>
  );
}
