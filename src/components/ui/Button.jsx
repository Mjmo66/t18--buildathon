import { Link } from 'react-router-dom';
import Spinner from './Spinner.jsx';

// variant: 'primary' | 'secondary' | 'danger' | 'ghost'; size: 'md' | 'sm'; block: full width.
// Pass `to` to render a router link styled as a button.
export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  to,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', className]
    .filter(Boolean)
    .join(' ');
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner size="sm" />}
      <span>{children}</span>
    </button>
  );
}
