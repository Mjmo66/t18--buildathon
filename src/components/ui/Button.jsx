import { useId } from 'react';
import { Link } from 'react-router-dom';
import Spinner from './Spinner.jsx';
import Tooltip from './Tooltip.jsx';

// The one button of the app. Always give it visible text.
// variant: 'primary' | 'secondary' | 'danger' | 'success'
// size: 'md' (48px, default) | 'lg' (56px: the one main action of a screen). 'sm' is treated as 'md'.
// block: full width. to: render a router link styled as a button. href: plain link (e.g. Maps).
// hint: "what happens when I press this", shown on hover / keyboard focus (desktop only).
// help: one short visible line under the button (phones too), only where a mistake would cost something.
// disabled + hint: rendered as aria-disabled so the hint (say why it's disabled) can still be read.
export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  to,
  href,
  type = 'button',
  hint,
  help,
  icon,
  className = '',
  onClick,
  children,
  ...rest
}) {
  const helpId = useId();
  const softDisabled = disabled && !!hint;
  const cls = [
    'btn',
    `btn-${variant === 'ghost' ? 'secondary' : variant}`,
    size === 'lg' && 'btn-lg',
    block && 'btn-block',
    softDisabled && 'is-disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const describedBy = [rest['aria-describedby'], help && `${helpId}-help`].filter(Boolean).join(' ') || undefined;
  const content = (
    <>
      {loading ? <Spinner size="sm" /> : icon}
      <span>{children}</span>
    </>
  );
  let el;
  if (to) {
    el = (
      <Link to={to} className={cls} onClick={onClick} {...rest} aria-describedby={describedBy}>
        {content}
      </Link>
    );
  } else if (href) {
    el = (
      <a href={href} className={cls} onClick={onClick} {...rest} aria-describedby={describedBy}>
        {content}
      </a>
    );
  } else {
    el = (
      <button
        type={type}
        className={cls}
        disabled={(disabled && !softDisabled) || loading}
        aria-disabled={softDisabled || undefined}
        aria-busy={loading || undefined}
        onClick={softDisabled ? (e) => e.preventDefault() : onClick}
        {...rest}
        aria-describedby={describedBy}
      >
        {content}
      </button>
    );
  }
  const withTip = hint ? <Tooltip hint={hint} block={block}>{el}</Tooltip> : el;
  if (!help) return withTip;
  return (
    <div className={`btn-with-help ${block ? 'btn-with-help-block' : ''}`}>
      {withTip}
      <p className="btn-help" id={`${helpId}-help`}>
        {help}
      </p>
    </div>
  );
}
