import Tooltip from './Tooltip.jsx';

// A small button with an icon AND its label as visible text. `label` is required.
// iconOnly (opt-in, avoid on the main path) hides the text but keeps it as aria-label.
export default function IconButton({ icon, label, hint, iconOnly = false, className = '', type = 'button', ...rest }) {
  if (!label) throw new Error('IconButton needs a label');
  const el = (
    <button type={type} className={`icon-button ${iconOnly ? 'icon-only' : ''} ${className}`} aria-label={iconOnly ? label : undefined} {...rest}>
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  );
  return hint ? <Tooltip hint={hint}>{el}</Tooltip> : el;
}
