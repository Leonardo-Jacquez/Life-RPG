import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { game } from '../../api/client.js';
import StatBar from '../../components/StatBar.jsx';
import BudgetBreakdown from '../../components/BudgetBreakdown.jsx';

const PATH_LABELS = {
  workforce:          'Entered the Workforce',
  military:           'Served in the Military',
  trade_school:       'Completed Trade School',
  community_college:  'Attended Community College',
  state_university:   'Graduated State University',
  private_university: 'Graduated Private University',
  ivy_league:         'Graduated Ivy League',
};

export default function Outcome() {
  const navigate  = useNavigate();
  const { state } = useLocation();
  const runId     = state?.runId;

  const [outcome, setOutcome]   = useState(null);
  const [run, setRun]           = useState(null);
  const [budget, setBudget]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!runId) { navigate('/student/game'); return; }

    async function load() {
      try {
        const { outcome: o } = await game.getOutcome(runId);
        setOutcome(o);

        const { runs } = await game.getRuns(localStorage.getItem('life_rpg_class_id'));
        const thisRun = runs.find(r => r.id === runId);
        if (thisRun) setRun(thisRun);

        // Try to load budget if career_code is set
        if (thisRun?.career_code) {
          const { budget: b } = await game.getBudget(runId, thisRun.career_code, 0.05);
          setBudget(b);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [runId]);

  async function handlePlayAgain() {
    navigate('/student/game');
  }

  if (loading) return <div className="page" style={{ justifyContent: 'center' }}><p>Computing your outcome…</p></div>;

  const score  = outcome?.total_score ?? 0;
  const pctVar = `${(score / 100) * 360}deg`;

  return (
    <div className="page">
      <div className="card card-wide">

        {/* Score ring */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            className="score-ring"
            style={{ '--pct': `${score}%` } /* fallback for browsers w/o @property */ }
          >
            <span>{score}</span>
          </div>
          <h1 style={{ marginBottom: 8 }}>Life Complete</h1>
          <p style={{ fontSize: '1rem' }}>
            {score >= 80 ? 'Outstanding life well lived!' :
             score >= 60 ? 'Solid outcome with room to grow.' :
             score >= 40 ? 'A challenging but honest life.' :
             'This run was a tough one. The next will be better.'}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Score breakdown */}
        {outcome?.breakdown && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Score Breakdown</h3>
            <div className="budget-grid" style={{ marginTop: 12 }}>
              <span className="budget-label">Net Worth (35%)</span>
              <span className="budget-val">{outcome.breakdown.net_worth_score}</span>
              <span className="budget-label">Career Attainment (35%)</span>
              <span className="budget-val">{outcome.breakdown.career_attainment_score}</span>
              <span className="budget-label">Quality of Life (30%)</span>
              <span className="budget-val">{outcome.breakdown.quality_of_life_score}</span>
              <div className="budget-divider" />
              <span className="budget-label budget-total">Final Score</span>
              <span className="budget-val budget-total">{score}</span>
            </div>
          </div>
        )}

        {/* Path taken */}
        {run?.path_id && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            <strong>Path taken:</strong> {PATH_LABELS[run.path_id] ?? run.path_id}
          </div>
        )}

        {/* Final stats */}
        {run?.stats && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Final Stats</h3>
            <StatBar stats={run.stats} />
          </div>
        )}

        {/* Budget breakdown */}
        {budget && (
          <div className="card" style={{ marginBottom: 16 }}>
            <BudgetBreakdown budget={budget} />
          </div>
        )}

        {/* Actions */}
        <div className="btn-row">
          <button className="btn-secondary" onClick={() => navigate('/student/join')}>
            Exit
          </button>
          <button className="btn-gold" style={{ flex: 1 }} onClick={handlePlayAgain}>
            Play Again →
          </button>
        </div>

        <p className="text-center text-muted" style={{ marginTop: 16, fontSize: '0.8rem' }}>
          Your results (anonymized) may be used to help researchers understand how young people think about life decisions.
        </p>
      </div>
    </div>
  );
}
