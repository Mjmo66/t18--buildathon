import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

// Wrap the app in <ToastProvider>; then `const toast = useToast(); toast('Saved', 'success')`.
// tone: 'info' | 'success' | 'warning' | 'danger'. Toasts disappear after 3.5 s.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const show = useCallback((message, tone = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.message}
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
