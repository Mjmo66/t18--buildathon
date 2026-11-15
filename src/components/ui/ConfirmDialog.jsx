import { useEffect, useId, useRef } from 'react';

// Ask before something that can't be undone. Plain words, two big buttons.
// The safe choice (cancelLabel) is focused by default; Escape and the backdrop also choose it.
// tone: 'danger' (red confirm button) | 'primary'.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Yes',
  cancelLabel = 'No, go back',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const id = useId();
  const safeRef = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    safeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      lastFocus.current?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel?.()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={children ? `${id}-b` : undefined}>
        <h2 id={`${id}-t`} className="dialog-title">{title}</h2>
        {children && <div id={`${id}-b`} className="dialog-body">{children}</div>}
        <div className="dialog-actions">
          <button type="button" className={`btn btn-${tone === 'danger' ? 'danger' : 'primary'} btn-block`} disabled={busy} onClick={onConfirm}>
            <span>{confirmLabel}</span>
          </button>
          <button type="button" ref={safeRef} className="btn btn-primary btn-block dialog-safe" onClick={onCancel}>
            <span>{cancelLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
