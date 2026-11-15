// Inline message. tone: 'info' | 'success' | 'warning' | 'danger'. onClose shows a dismiss button.
export default function Alert({ tone = 'info', title, onClose, children }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <div className="alert-body">
        {title && <strong className="alert-title">{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
