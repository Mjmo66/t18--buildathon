import { useId } from 'react';

// Label + control. as: 'input' (default) | 'select' | 'textarea'.
// For select, pass `options` ([{value, label}] or strings) or children <option>s.
// All other props go to the control (value, onChange, type, placeholder, required, ...).
export default function Field({ label, hint, error, as = 'input', options, children, className = '', ...rest }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const common = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, ...rest };
  let control;
  if (as === 'select') {
    control = (
      <select className="field-control" {...common}>
        {options
          ? options.map((o) => {
              const opt = typeof o === 'string' ? { value: o, label: o } : o;
              return (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              );
            })
          : children}
      </select>
    );
  } else if (as === 'textarea') {
    control = <textarea className="field-control" rows={4} {...common} />;
  } else {
    control = <input className="field-control" {...common} />;
  }
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      {control}
      {error ? (
        <p className="field-error" id={`${id}-err`}>
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
