import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

// Wrap the app in <ToastProvider>; then `const toast = useToast(); toast('Saved', 'success')`.
// tone: 'info' | 'success' | 'warning' | 'danger'. Toasts show at the top for 6 s.
// Optional third argument: { action: { label: 'Undo', onClick } } adds a button to the toast.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message, tone = 'info', opts = {}) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, message, tone, action: opts.action }]);
      setTimeout(() => dismiss(id), opts.duration ?? 6000);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  dismiss(t.id);
                  t.action.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  // Outside the provider (tests, storybook) fall back to the console instead of crashing.
  return show ?? ((message) => console.info('[toast]', message));
}
