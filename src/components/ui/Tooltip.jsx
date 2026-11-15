import { cloneElement, useEffect, useId, useRef, useState } from 'react';

// Small styled explanation shown above a control on hover and on keyboard focus (desktop).
// Never the only label: the child must already have visible text. Linked with aria-describedby.
// Usage: <Tooltip hint="What happens when I press this"><button>…</button></Tooltip>
export default function Tooltip({ hint, children }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!hint) return children;

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 300);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') hide();
  };
  const describedBy = [children.props['aria-describedby'], `${id}-tip`].filter(Boolean).join(' ');

  return (
    <span className="tooltip-wrap" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onKeyDown={onKey}>
      {cloneElement(children, { 'aria-describedby': describedBy })}
      <span role="tooltip" id={`${id}-tip`} className={`tooltip ${open ? 'is-open' : ''}`}>
        {hint}
      </span>
    </span>
  );
}
