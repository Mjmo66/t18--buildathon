import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };

// Inline message. tone: 'info' | 'success' | 'warning' | 'danger'. onClose shows a dismiss button.
export default function Alert({ tone = 'info', title, onClose, children }) {
  const ToneIcon = ICONS[tone] ?? Info;
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <ToneIcon className="alert-icon" size={18} strokeWidth={2} aria-hidden="true" />
      <div className="alert-body">
        {title && <strong className="alert-title">{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Dismiss">
          <X size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
