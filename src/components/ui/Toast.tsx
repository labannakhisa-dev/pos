import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const toneConfig: Record<ToastTone, { icon: ReactNode; bg: string; border: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5 text-success-600" />, bg: 'bg-success-50', border: 'border-success-100' },
  error: { icon: <XCircle className="h-5 w-5 text-danger-600" />, bg: 'bg-danger-50', border: 'border-danger-100' },
  info: { icon: <Info className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50', border: 'border-blue-100' },
  warning: { icon: <AlertTriangle className="h-5 w-5 text-warning-600" />, bg: 'bg-warning-50', border: 'border-warning-100' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => {
          const cfg = toneConfig[t.tone];
          return (
            <div key={t.id} className={`flex items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} p-3.5 shadow-pop animate-slide-up`}>
              <div className="shrink-0">{cfg.icon}</div>
              <p className="flex-1 text-sm text-ink-800">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="shrink-0 text-ink-400 hover:text-ink-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
