import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { game } from '../../api/client.js';

const PHASE_NEXT = { high_school: 'college', college: 'adult' };

const PATH_DESCRIPTIONS = {
  workforce:          'Enter the workforce directly. Start earning right away — no debt, but lower earning ceiling.',
  military:           'Serve your country. Structured career path with benefits, housing, and education support.',
  trade_school:       'Electrician, plumber, HVAC tech. High demand, lower debt than college, strong wages.',
  community_college:  'Two-year degree or transfer path. Affordable way to explore before committing.',
  state_university:   'Four-year degree at an in-state school. Balance of cost and opportunity.',
  private_university: 'Higher tuition, stronger alumni networks, and broader academic programs.',
  ivy_league:         'The most selective path. Maximum doors opened — if you can handle the debt.',
};

export default function PhaseTransition() {
  const navigate   = useNavigate();
  const { state }  = useLocation();
  const runId      = state?.runId;
  const fromPhase  = state?.phase;

  const [paths, setPaths]       = useState([]);
  const [selected, setSelected] = useState(null);
  const [score, setScore]       = useState(null);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!runId) { navigate('/student/game'); return; }

    game.getPaths(runId)
      .then(({ paths, opportunity_score }) => {
        setPaths(paths);
        setScore(opportunity_score);
      })
      .catch(err => setError(err.message));
  }, [runId]);

  async function handleAdvance() {
    if (!selected) return;
    setAdvancing(true);
    setError('');
    try {
      const nextPhase = PHASE_NEXT[fromPhase];
      await game.advancePhase(runId, nextPhase, selected);
      navigate('/student/game');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdvancing(false);
    }
  }

  const fromLabel = fromPhase === 'high_school' ? 'High School' : 'College';

  return (
    <div className="page">
      <div className="card card-wide">
        <div className="title-block">
          <h1>Graduation Day</h1>
          <p>You've completed {fromLabel}. Your opportunity score determines what paths are open to you.</p>
          {score != null && (
            <div style={{ marginTop: 12 }}>
              <span style={{ fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 700 }}>
                Opportunity Score: {score}
              </span>
            </div>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <h2>Choose your next path</h2>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          Only paths you've earned are available. Choose carefully — this affects everything that follows.
        </p>

        <div className="path-grid">
          {paths.map(path => (
            <div
              key={path.id}
              className={`path-card ${selected === path.id ? 'selected' : ''}`}
              onClick={() => setSelected(path.id)}
            >
              <h3>{path.label}</h3>
              <p>{PATH_DESCRIPTIONS[path.id]}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <button
            className="btn-gold btn-full"
            onClick={handleAdvance}
            disabled={!selected || advancing}
          >
            {advancing ? 'Advancing…' : `Begin ${PHASE_NEXT[fromPhase] === 'college' ? 'College' : 'Adult Life'} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
