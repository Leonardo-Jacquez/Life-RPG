import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teacher, auth } from '../../api/client.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    teacher.getClasses()
      .then(({ classes: c }) => setClasses(c))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { class: newClass } = await teacher.createClass(newName.trim());
      setClasses(prev => [newClass, ...prev]);
      setNewName('');
      setShowNew(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleLogout() {
    await auth.logout();
    localStorage.clear();
    navigate('/teacher/login');
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem' }}>My Classes</h1>
        <div className="btn-row" style={{ margin: 0 }}>
          <button className="btn-primary" onClick={() => setShowNew(true)}>+ New Class</button>
          <button className="btn-secondary" onClick={handleLogout}>Sign out</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ width: '100%', maxWidth: 900 }}>{error}</div>}

      {/* New class form */}
      {showNew && (
        <div className="card" style={{ width: '100%', maxWidth: 900, marginBottom: 24 }}>
          <h2>Create a new class</h2>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Class name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Period 3 — Life Skills"
                autoFocus
              />
            </div>
            <div className="btn-row">
              <button className="btn-secondary" type="button" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn-primary" type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create Class'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Class grid */}
      {loading ? (
        <p>Loading…</p>
      ) : classes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <p>You haven't created any classes yet.</p>
          <button className="btn-primary" onClick={() => setShowNew(true)}>Create your first class</button>
        </div>
      ) : (
        <div className="class-grid" style={{ width: '100%', maxWidth: 900 }}>
          {classes.map(c => (
            <div key={c.id} className="class-card" onClick={() => navigate(`/teacher/class/${c.id}`)}>
              <div className="class-code">{c.class_code}</div>
              <h3 style={{ marginTop: 8, marginBottom: 4 }}>{c.name}</h3>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                {c.student_count ?? 0} student{c.student_count !== '1' ? 's' : ''}
              </p>
              {c.snapshot_label && (
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--green)' }}>
                  Snapshot: {c.snapshot_label} {c.snapshot_locked_at ? '(locked)' : '(draft)'}
                </p>
              )}
              {!c.snapshot_label && (
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  No snapshot yet
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
