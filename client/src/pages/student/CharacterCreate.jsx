import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../../api/client.js';

// ─── Psychometric questions (covert OCEAN + Grit + FTP collection) ────────────
// These read like personality/avatar questions, not a clinical survey.
// Each answer maps to a trait score; the mapping is never shown to students.

const QUESTIONS = [
  {
    id: 'q_openness',
    trait: 'O',
    text: 'You have a free afternoon with no plans. What sounds most appealing?',
    options: [
      { label: 'Try something completely new — a skill, a place, or an idea',     score: 1.0 },
      { label: 'Mix it up — part familiar, part something a little different',     score: 0.5 },
      { label: 'Stick to what you know and love — comfort is the best comfort',    score: 0.0 },
    ],
  },
  {
    id: 'q_conscientiousness',
    trait: 'C',
    text: 'There\'s a big project due in two weeks. When do you start?',
    options: [
      { label: 'Right away — I make a plan and chip away at it each day',          score: 1.0 },
      { label: 'I\'ll think about it this week and start next week',               score: 0.5 },
      { label: 'Probably the night before — I do my best work under pressure',     score: 0.0 },
    ],
  },
  {
    id: 'q_extraversion',
    trait: 'E',
    text: 'What\'s your ideal Friday night?',
    options: [
      { label: 'A big hangout with lots of people — the more the merrier',         score: 1.0 },
      { label: 'A smaller get-together with a handful of close friends',            score: 0.5 },
      { label: 'A quiet night in — recharge, relax, do your thing',               score: 0.0 },
    ],
  },
  {
    id: 'q_agreeableness',
    trait: 'A',
    text: 'Your friend asks to borrow your favorite hoodie for the weekend. You…',
    options: [
      { label: 'Hand it over without a second thought — what\'s mine is yours',    score: 1.0 },
      { label: 'Say yes, but quietly hope they return it in good shape',           score: 0.5 },
      { label: 'Come up with a reason you need it — it\'s special to you',        score: 0.0 },
    ],
  },
  {
    id: 'q_neuroticism',
    trait: 'N',
    text: 'The night before a big test, how do you feel?',
    options: [
      { label: 'Pretty calm — you\'ve done what you can, so why stress?',          score: 0.0 },
      { label: 'A little nervous, but manageable',                                 score: 0.5 },
      { label: 'Anxious — running through everything that could go wrong',         score: 1.0 },
    ],
  },
  {
    id: 'q_grit',
    trait: 'grit',
    text: 'You\'ve been learning something hard for six months and you\'re still struggling. You…',
    options: [
      { label: 'Keep going — setbacks are part of the process and I\'m not done',  score: 1.0 },
      { label: 'Still trying, but starting to wonder if it\'s worth it',           score: 0.5 },
      { label: 'Start thinking maybe this just isn\'t for me',                     score: 0.0 },
    ],
  },
  {
    id: 'q_ftp',
    trait: 'ftp',
    text: 'When you picture your life 10 years from now…',
    options: [
      { label: 'I have a clear vision and I\'m already working toward it',         score: 1.0 },
      { label: 'I have some ideas but haven\'t figured out the details',           score: 0.5 },
      { label: 'The future feels too far off to think about seriously',            score: 0.0 },
    ],
  },
];

const AVATARS = ['🦊', '🐉', '🦁', '🐺', '🦅', '🐬', '🦋', '🐙', '🦄', '🐯'];

export default function CharacterCreate() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);       // 0 = avatar, 1-7 = psych questions, 8 = done
  const [avatar, setAvatar] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const totalSteps = 1 + QUESTIONS.length; // avatar + questions

  function handleAnswer(questionId, score) {
    setAnswers(prev => ({ ...prev, [questionId]: score }));
  }

  function nextStep() {
    if (step === 0 && !avatar) { setError('Pick an avatar to continue.'); return; }
    const q = QUESTIONS[step - 1];
    if (step > 0 && answers[q?.id] == null) { setError('Select an answer to continue.'); return; }
    setError('');
    setStep(s => s + 1);
  }

  function prevStep() {
    setError('');
    setStep(s => Math.max(0, s - 1));
  }

  // Compute psychometric profile from answers
  function buildArchetypes() {
    const profile = { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5, grit: 0.5, ftp: 0.5 };
    for (const q of QUESTIONS) {
      const score = answers[q.id];
      if (score != null) profile[q.trait] = score;
    }
    return profile;
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const archetypes = buildArchetypes();
      const classId = localStorage.getItem('life_rpg_class_id');

      // Save psychometric profile + character prefs via game run creation
      await api.post('/game/run/character', {
        class_id: classId,
        avatar,
        archetypes,
        raw_responses: answers,
      });

      navigate('/student/game');
    } catch (err) {
      setError(err.message ?? 'Failed to save character. Try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const progress = Math.round((step / totalSteps) * 100);

  return (
    <div className="page" style={{ justifyContent: 'center' }}>
      <div className="card">
        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="text-muted">Character Setup</span>
            <span className="text-muted">{step} / {totalSteps}</span>
          </div>
          <div className="stat-track" style={{ height: 6 }}>
            <div className="stat-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Step 0: Avatar picker */}
        {step === 0 && (
          <>
            <h2>Choose your avatar</h2>
            <p>This is how you'll appear on the class board.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, margin: '20px 0' }}>
              {AVATARS.map(a => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  style={{
                    fontSize: '2rem',
                    padding: '12px',
                    background: avatar === a ? 'rgba(124,58,237,0.2)' : 'var(--surface)',
                    border: `2px solid ${avatar === a ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Steps 1–7: Psychometric questions */}
        {step >= 1 && step <= QUESTIONS.length && (
          <div className="psych-question">
            <h2 style={{ marginBottom: 16 }}>
              Question {step} of {QUESTIONS.length}
            </h2>
            <h3>{QUESTIONS[step - 1].text}</h3>
            <div className="psych-options">
              {QUESTIONS[step - 1].options.map((opt, i) => (
                <button
                  key={i}
                  className={`psych-option ${answers[QUESTIONS[step - 1].id] === opt.score ? 'selected' : ''}`}
                  onClick={() => handleAnswer(QUESTIONS[step - 1].id, opt.score)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Final confirmation */}
        {step === totalSteps && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: '4rem', marginBottom: 12 }}>{avatar}</div>
              <h2>You're ready to start!</h2>
              <p>Your choices begin in high school. Every decision matters — and compounds.</p>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="btn-row">
          {step > 0 && (
            <button className="btn-secondary" onClick={prevStep} disabled={saving}>
              ← Back
            </button>
          )}
          {step < totalSteps && (
            <button className="btn-primary" style={{ flex: 1 }} onClick={nextStep}>
              {step === 0 ? 'Next →' : 'Next →'}
            </button>
          )}
          {step === totalSteps && (
            <button className="btn-gold" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Starting…' : 'Begin My Life →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
