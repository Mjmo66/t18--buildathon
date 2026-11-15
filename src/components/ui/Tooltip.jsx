import { cloneElement, useEffect, useId, useRef, useState } from 'react';

const canHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

// Small styled explanation shown above a control (below when there is no room above): on mouse hover (only on devices that can hover)
// and on keyboard focus. Never the only label: the child must already have visible text.
// Linked with aria-describedby; Escape closes it; it stays open while the pointer is over it.
// Usage: <Tooltip hint="What happens when I press this"><button>…</button></Tooltip>
export default function Tooltip({ hint, block = false, children }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [below, setBelow] = useState(false);
  const timer = useRef();
  const wrap = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!hint) return children;

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // Flip below when the space above is too small (sticky header, page title).
      const top = wrap.current?.getBoundingClientRect().top ?? 999;
      setBelow(top < 140);
      setOpen(true);
    }, 400);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };
  const onFocus = (e) => {
    // Keyboard focus only: a tap on a phone also focuses, and phones show the visible label instead.
    if (e.target.matches?.(':focus-visible')) show();
  };
  const describedBy = [children.props['aria-describedby'], `${id}-tip`].filter(Boolean).join(' ');

  return (
    <span
      ref={wrap}
      className={`tooltip-wrap ${block ? 'tooltip-wrap-block' : ''}`}
      onMouseEnter={() => canHover() && show()}
      onMouseLeave={hide}
      onFocus={onFocus}
      onBlur={hide}
    >
      {cloneElement(children, { 'aria-describedby': describedBy })}
      <span role="tooltip" id={`${id}-tip`} className={`tooltip ${open ? 'is-open' : ''} ${below ? 'is-below' : ''}`}>
        {hint}
      </span>
    </span>
  );
}
