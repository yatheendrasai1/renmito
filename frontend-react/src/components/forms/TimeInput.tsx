import './TimeInput.css';

interface Props {
  label: string;
  value: string;          // HH:MM
  onChange: (v: string) => void;
}

/** Clamps a minute value to valid HH:MM. */
function addMins(hhmm: string, delta: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total  = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + delta));
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}

function isValidTime(v: string): boolean {
  return /^\d{2}:\d{2}$/.test(v);
}

export default function TimeInput({ label, value, onChange }: Props) {
  return (
    <div className="time-input-wrap">
      <span className="time-input-label">{label}</span>
      <div className="time-input-row">
        <button className="time-step-btn" onClick={() => onChange(addMins(value, -15))} title="-15 min">−15</button>
        <button className="time-step-btn" onClick={() => onChange(addMins(value, -5))}  title="-5 min">−5</button>
        <input
          className="time-input-field"
          type="text"
          value={value}
          maxLength={5}
          placeholder="HH:MM"
          onChange={e => onChange(e.target.value)}
          onBlur={e => {
            const v = e.target.value;
            if (!isValidTime(v)) onChange(value); // revert bad input
          }}
        />
        <button className="time-step-btn" onClick={() => onChange(addMins(value, +5))}  title="+5 min">+5</button>
        <button className="time-step-btn" onClick={() => onChange(addMins(value, +15))} title="+15 min">+15</button>
      </div>
    </div>
  );
}
