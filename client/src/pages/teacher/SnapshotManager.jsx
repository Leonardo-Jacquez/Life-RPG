import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { snapshot as snapshotApi } from '../../api/client.js';

export default function SnapshotManager() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [snap, setSnap]           = useState(null);
  const [occupations, setOccs]    = useState([]);
  const [search, setSearch]       = useState('');
  const [label, setLabel]         = useState('');
  const [pulling, setPulling]     = useState(false);
  const [locking, setLocking]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  useEffect(() => {
    snapshotApi.get(id)
      .then(({ snapshot }) => {
        setSnap(snapshot);
        if (snapshot) {
          return snapshotApi.occupations(id, { limit: 50 });
        }
      })
      .then(data => { if (data) setOccs(data.occupations); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSearch() {
    try {
      const { occupations: results } = await snapshotApi.occupations(id, { search, limit: 50 });
      setOccs(results);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePull() {
    if (!label.trim()) { setError('Enter a label for this snapshot (e.g. "Fall 2025")'); return; }
    setPulling(true);
    setError('');
    try {
      const { snapshot_id } = await snapshotApi.pull(id, label.trim());
      setSuccess(`Data pull initiated (snapshot ${snapshot_id.slice(-8)}). This may take a minute. Refresh to check progress.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setPulling(false);
    }
  }

  async function handleLock() {
    if (!snap?.id) return;
    if (!window.confirm('Lock this snapshot? It cannot be changed after locking — all students in this class will use this data for the semester.')) return;
    setLocking(true);
    setError('');
    try {
      await snapshotApi.lock(id, snap.id);
      setSuccess('Snapshot locked! Students will now use this economic data.');
      const { snapshot: updated } = await snapshotApi.get(id);
      setSnap(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLocking(false);
    }
  }

  const isLocked = !!snap?.locked_at;

  if (loading) return <div className="page" style={{ justifyContent: 'center' }}><p>Loading snapshot…</p></div>;

  return (
    <div className="page">
      <div style={{ width: '100%', maxWidth: 900, marginBottom: 16 }}>
        <button className="btn-secondary" onClick={() => navigate(`/teacher/class/${id}`)}>
          ← Class View
        </button>
        <h1 style={{ marginTop: 12 }}>Semester Snapshot</h1>
        <p>
          Pull real-world data from BLS, USDA, and Census at the start of each semester.
          Lock it to freeze conditions for the entire class — all students play with the same economy.
        </p>
      </div>

      {error   && <div className="alert alert-error"   style={{ width: '100%', maxWidth: 900, marginBottom: 12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ width: '100%', maxWidth: 900, marginBottom: 12 }}>{success}</div>}

      {/* Snapshot status */}
      <div className="card card-wide" style={{ marginBottom: 16 }}>
        <h2>Status</h2>
        {!snap ? (
          <p>No snapshot yet. Pull data to create one.</p>
        ) : (
          <div className="budget-grid" style={{ marginTop: 8 }}>
            <span className="budget-label">Label</span>
            <span className="budget-val">{snap.label}</span>
            <span className="budget-label">Occupations</span>
            <span className="budget-val">{snap.occupation_count ?? 0}</span>
            <span className="budget-label">Avg rent (1BR)</span>
            <span className="budget-val">{snap.median_rent_1br ? `$${snap.median_rent_1br}/mo` : '—'}</span>
            <span className="budget-label">Monthly groceries</span>
            <span className="budget-val">{snap.monthly_groceries ? `$${snap.monthly_groceries}/mo` : '—'}</span>
            <span className="budget-label">Loan rate</span>
            <span className="budget-val">{snap.federal_loan_rate_pct ? `${snap.federal_loan_rate_pct}%` : '—'}</span>
            <span className="budget-label">Status</span>
            <span className={`budget-val ${isLocked ? 'solvent-yes' : 'text-gold'}`}>
              {isLocked ? `Locked ${new Date(snap.locked_at).toLocaleDateString()}` : 'Draft (not locked)'}
            </span>
          </div>
        )}

        {/* Pull controls */}
        {!isLocked && (
          <div style={{ marginTop: 20 }}>
            <h3>Pull fresh data</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              This fetches salary, cost-of-living, and tuition data from public APIs.
              Do this at the start of each semester, then lock.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder='Semester label, e.g. "Fall 2025"'
                style={{ flex: 1, minWidth: 200 }}
              />
              <button className="btn-primary" onClick={handlePull} disabled={pulling}>
                {pulling ? 'Pulling…' : 'Pull Data'}
              </button>
            </div>
          </div>
        )}

        {/* Lock control */}
        {snap && !isLocked && (
          <div style={{ marginTop: 16 }}>
            <button className="btn-gold" onClick={handleLock} disabled={locking}>
              {locking ? 'Locking…' : 'Lock Snapshot for Semester'}
            </button>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
              Locking is permanent and cannot be undone.
            </p>
          </div>
        )}
      </div>

      {/* Occupation browser */}
      {snap && (
        <div className="card card-wide">
          <h2>Career Browser</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            All ~{snap.occupation_count ?? 0} careers available to students, with real salary data.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search by title or SOC code…"
              style={{ flex: 1 }}
            />
            <button className="btn-secondary" onClick={handleSearch}>Search</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="student-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>SOC Code</th>
                  <th>Median Wage</th>
                  <th>Growth</th>
                  <th>Typical Education</th>
                </tr>
              </thead>
              <tbody>
                {occupations.map(occ => (
                  <tr key={occ.soc_code}>
                    <td>{occ.title}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{occ.soc_code}</td>
                    <td style={{ fontWeight: 600 }}>
                      ${Number(occ.median_annual_wage).toLocaleString()}
                    </td>
                    <td style={{ color: occ.projected_growth_pct > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {occ.projected_growth_pct > 0 ? '+' : ''}{occ.projected_growth_pct}%
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {occ.typical_education}
                    </td>
                  </tr>
                ))}
                {occupations.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No results.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
