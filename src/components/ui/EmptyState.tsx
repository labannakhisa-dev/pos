import type { ReactNode } from 'react';

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in">
      {icon && <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ink-100 text-ink-400">{icon}</div>}
      <h3 className="font-display font-semibold text-ink-700">{title}</h3>
      {message && <p className="mt-1 text-sm text-ink-500 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
