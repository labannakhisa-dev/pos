import type { ReactNode } from 'react';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClasses: Record<Tone, string> = {
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-success-100 text-success-600',
  warning: 'bg-warning-100 text-warning-600',
  danger: 'bg-danger-100 text-danger-600',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-ink-100 text-ink-600',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`badge ${toneClasses[tone]} ${className}`}>{children}</span>;
}
