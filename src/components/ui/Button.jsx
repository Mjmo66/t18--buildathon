import { Link } from 'react-router-dom';
import Spinner from './Spinner.jsx';
import Tooltip from './Tooltip.jsx';

// variant: 'primary' | 'secondary' | 'danger' | 'ghost'; size: 'md' | 'sm'; block: full width.
// Pass `to` to render a router link styled as a button.
// hint: one sentence "what happens when I press this", shown on hover / keyboard focus (desktop).
// The button text stays the real label; the hint only adds to it.
export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  to,
  type = 'button',
  hint,
  className = '',
  children,
  ...rest
}) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', className]
    .filter(Boolean)
    .join(' ');
  const el = to ? (
    <Link to={to} className={cls} {...rest}>
      {children}
    </Link>
  ) : (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner size="sm" />}
      <span>{children}</span>
    </button>
  );
  if (!hint) return el;
  return (
    <Tooltip hint={hint}>
      {el}
    </Tooltip>
  );
}
