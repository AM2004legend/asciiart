import { useId } from 'react';

/** Icon-only button with a hover/focus tooltip that shows its shortcut. */
export function IconButton({ label, shortcut, icon, pressed, className = '', ...props }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} aria-pressed={pressed} {...props}>
      {icon}
      <span className="tip" aria-hidden="true">
        {label}
        {shortcut && <kbd>{shortcut}</kbd>}
      </span>
    </button>
  );
}

/** Range input with a live value readout. Double-click resets to `defaultValue`. */
export function Slider({ label, value, min, max, step = 1, format = String, onChange, defaultValue, disabled }) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="field" data-disabled={disabled || undefined}>
      <div className="field-row">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--fill': `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
        title={defaultValue !== undefined ? 'Double-click to reset' : undefined}
      />
    </div>
  );
}

export function Switch({ label, hint, checked, onChange }) {
  const id = useId();
  return (
    <div className="field field-switch">
      <div>
        <label htmlFor={id}>{label}</label>
        {hint && <p className="hint">{hint}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

export function Segmented({ label, value, options, onChange }) {
  const id = useId();
  return (
    <div className="field">
      <span className="field-label" id={id}>{label}</span>
      <div className="segmented" role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
