import { useState } from 'react';

/**
 * Renders a decision event with selectable choices.
 *
 * props:
 *   event       — { prompt_text, choices: [{ id, choice_text }] }
 *   onSubmit    — (choiceId) => void
 *   disabled    — bool (while waiting for server response)
 *   outcomeText — string (shown after choice is confirmed)
 */
export default function DecisionCard({ event, onSubmit, disabled, outcomeText }) {
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  function handleSelect(id) {
    if (disabled || confirmed) return;
    setSelected(id);
  }

  function handleSubmit() {
    if (!selected || confirmed) return;
    setConfirmed(true);
    onSubmit(selected);
  }

  if (!event) return null;

  return (
    <div>
      <p className="event-prompt">{event.prompt_text}</p>

      <div className="choices">
        {event.choices.map(choice => (
          <button
            key={choice.id}
            className={`choice-btn ${selected === choice.id ? 'selected' : ''}`}
            onClick={() => handleSelect(choice.id)}
            disabled={disabled || confirmed}
          >
            {choice.choice_text}
          </button>
        ))}
      </div>

      {!confirmed && selected && (
        <div style={{ marginTop: 16 }}>
          <button
            className="btn-primary btn-full"
            onClick={handleSubmit}
            disabled={disabled}
          >
            Confirm choice
          </button>
        </div>
      )}

      {outcomeText && (
        <div className="outcome-text">{outcomeText}</div>
      )}
    </div>
  );
}
