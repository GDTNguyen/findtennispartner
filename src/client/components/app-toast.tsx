import { useEffect, useRef, useState } from 'react';
import { subscribeAppToast, type AppToastMessage } from '../lib/app-toast-bus';

const TOAST_DISMISS_MS = 5000;

export function AppToastHost() {
  const [toast, setToast] = useState<AppToastMessage | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return subscribeAppToast((message) => {
      setToast(message);
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
      dismissTimerRef.current = window.setTimeout(() => {
        setToast(null);
        dismissTimerRef.current = null;
      }, TOAST_DISMISS_MS);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      className={`app-toast app-toast--${toast.variant}`}
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
    >
      {toast.text}
    </div>
  );
}
