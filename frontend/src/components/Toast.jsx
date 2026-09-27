// AeroRoute — Toast notification system
import { useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

let _addToast = null;

export function toast(message, type = 'info') {
  _addToast?.({ message, type, id: Date.now() + Math.random() });
}

const ICONS = {
  success: <CheckCircle size={16} color="var(--brand-accent)" />,
  error:   <XCircle    size={16} color="var(--brand-danger)"  />,
  warning: <AlertTriangle size={16} color="var(--brand-warning)" />,
  info:    <Info       size={16} color="var(--brand-primary)" />,
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  _addToast = useCallback((t) => {
    setToasts(prev => [...prev, t]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== t.id));
    }, 4000);
  }, []);

  const remove = (id) => setToasts(prev => prev.filter(x => x.id !== id));

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} style={{ position: 'relative' }}>
          {ICONS[t.type] || ICONS.info}
          <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
