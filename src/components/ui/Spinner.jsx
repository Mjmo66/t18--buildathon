// size: 'sm' | 'md' | 'lg'. Pass `label` to show text beside it; `center` to centre in its container.
export default function Spinner({ size = 'md', label, center = false }) {
  const spinner = <span className={`spinner spinner-${size}`} role="status" aria-label={label ?? 'Loading'} />;
  if (!label && !center) return spinner;
  return (
    <div className={`spinner-wrap ${center ? 'spinner-center' : ''}`}>
      {spinner}
      {label && <span className="spinner-label">{label}</span>}
    </div>
  );
}
