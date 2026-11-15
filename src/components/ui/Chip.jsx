// Toggleable pill. Pass `selected` + `onClick` for filters / multi-select, or neither for a static tag.
export default function Chip({ selected = false, onClick, className = '', children, ...rest }) {
  const cls = ['chip', selected && 'chip-selected', className].filter(Boolean).join(' ');
  if (!onClick) {
    return (
      <span className={cls} {...rest}>
        {children}
      </span>
    );
  }
  return (
    <button type="button" className={cls} aria-pressed={selected} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
