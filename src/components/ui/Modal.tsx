import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-pop animate-scale-in`}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-ink-100">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 p-5 border-t border-ink-100 bg-ink-50/50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}
