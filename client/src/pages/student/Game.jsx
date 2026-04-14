import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { game } from '../../api/client.js';
import StatBar from '../../components/StatBar.jsx';
import DecisionCard from '../../components/DecisionCard.jsx';

const PHASE_LABELS = {
  high_school: 'High School',
  college:     'College',
  adult:       'Adult Life',
};

// Events per phase before triggering a transition check
const EVENTS_PER_PHASE = { high_school: 8, college: 8, adult: 10 };

export default function Game() {
  const navigate = useNavigate();
  const classId  = localStorage.getItem('life_rpg_class_id');
  const wsRef    = useRef(null);

  const [run, setRun]             = useState(null);
  const [event, setEvent]         = useState(null);
  const [prevStats, setPrevStats] = useState(null);
  const [outcomeText, setOutcomeText] = useState('');
  const [eventsThisPhase, setEventsThisPhase] = useState(0);
  const [ripple, setRipple]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [classStats, setClassStats] = useState(null); // aggregate visibility

  // ── Bootstrap ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const { run: activeRun } = await game.getActiveRun(classId);
        setRun(activeRun);
        await drawEvent(activeRun);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [classId]);

  // ── WebSocket for live class updates & ripple broadcasts ──────────────────

  useEffect(() => {
    const token = localStorage.getItem('life_rpg_token');
    if (!token || !classId) return;

    const ws = new WebSocket(`/ws?token=${token}&class_id=${classId}`);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'CLASS_UPDATE') setClassStats(data);
      if (data.type === 'RIPPLE') {
        setRipple(data);
        setTimeout(() => setRipple(null), 6000);
      }
    };

    return () => ws.close();
  }, [classId]);

  // ── Draw next event ───────────────────────────────────────────────────────

  const drawEvent = useCallback(async (activeRun) => {
    const { event: next } = await game.nextEvent(activeRun.id);
    setEvent(next);
    setOutcomeText('');
    setPrevStats(null);
  }, []);

  // ── Submit choice ─────────────────────────────────────────────────────────

  async function handleChoice(choiceId) {
    if (!event || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const choice = event.choices.find(c => c.id === choiceId);
      const result = await game.submitChoice(run.id, event.id, choiceId);

      setPrevStats({ ...run.stats });
      setOutcomeText(choice?.outcome_text ?? '');
      setRun(prev => ({ ...prev, stats: result.stats }));
      setEventsThisPhase(n => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Continue to next event ────────────────────────────────────────────────

  async function handleContinue() {
    const threshold = EVENTS_PER_PHASE[run.phase] ?? 8;
    if (eventsThisPhase >= threshold && run.phase !== 'adult') {
      // Time for a phase transition
      navigate('/student/transition', { state: { runId: run.id, phase: run.phase } });
      return;
    }
    if (run.phase === 'adult' && eventsThisPhase >= threshold) {
      navigate('/student/outcome', { state: { runId: run.id } });
      return;
    }
    setOutcomeText('');
    setPrevStats(null);
    await drawEvent(run);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="page" style={{ justifyContent: 'center' }}><p>Loading your life…</p></div>;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 560, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="phase-badge">{PHASE_LABELS[run?.phase] ?? run?.phase}</span>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            Life #{run?.run_number}  ·  Event {eventsThisPhase + 1}
          </span>
        </div>
      </div>

      {/* Stats */}
      {run && (
        <div className="card" style={{ marginBottom: 16 }}>
          <StatBar stats={run.stats} prev={prevStats} />
        </div>
      )}

      {/* Ripple banner */}
      {ripple?.firedRipple && (
        <div className="ripple-banner" style={{ width: '100%', maxWidth: 560, marginBottom: 16 }}>
          <strong style={{ color: 'var(--gold)' }}>Class Ripple Event!</strong><br />
          <span style={{ fontSize: '0.9rem' }}>Your class's choices are affecting everyone's outcomes…</span>
        </div>
      )}

      {/* Aggregate class stats (if teacher set visibility = aggregate) */}
      {classStats?.aggregate && (
        <div className="alert alert-info" style={{ width: '100%', maxWidth: 560, marginBottom: 16 }}>
          Class average: Academic {Math.round(classStats.aggregate.academic)} ·
          Work Ethic {Math.round(classStats.aggregate.work_ethic)}
        </div>
      )}

      {/* Error */}
      {error && <div className="alert alert-error" style={{ width: '100%', maxWidth: 560 }}>{error}</div>}

      {/* Event card */}
      {event ? (
        <div className="card">
          <DecisionCard
            event={event}
            onSubmit={handleChoice}
            disabled={submitting}
            outcomeText={outcomeText}
          />
          {outcomeText && (
            <div style={{ marginTop: 16 }}>
              <button className="btn-primary btn-full" onClick={handleContinue}>
                Continue →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>No more events for this phase.</p>
          <button className="btn-primary" onClick={handleContinue}>
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}
