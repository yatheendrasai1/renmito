import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import './Toast.css';

/** Global toast — reads from Zustand store and auto-dismisses after 4 s. */
export default function Toast() {
  const toast       = useAppStore(s => s.toast);
  const dismissToast = useAppStore(s => s.dismissToast);

  // Auto-dismiss after 4 s whenever a new toast appears
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismissToast, 4000);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div className="shell-toast">
      <span className="shell-toast-msg">✓ {toast.message}</span>
      {toast.undoFn && (
        <button className="shell-toast-undo" onClick={() => { toast.undoFn?.(); dismissToast(); }}>
          Undo
        </button>
      )}
    </div>
  );
}
