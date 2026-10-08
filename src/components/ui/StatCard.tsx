import type { ReactNode } from 'react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  hint?: string;
  loading?: boolean;
}

const toneStyles: Record<NonNullable<StatCardProps['tone']>, { bg: string; text: string }> = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600' },
  accent: { bg: 'bg-accent-50', text: 'text-accent-600' },
  success: { bg: 'bg-success-50', text: 'text-success-600' },
  warning: { bg: 'bg-warning-50', text: 'text-warning-600' },
  danger: { bg: 'bg-danger-50', text: 'text-danger-600' },
  info: { bg: 'bg-blue-50', text: 'text-blue-600' },
};

export function StatCard({ label, value, icon, tone = 'brand', hint, loading }: StatCardProps) {
  const ts = toneStyles[tone];
  return (
    <Card padding="md" className="transition hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
          {loading ? <div className="skeleton mt-2 h-7 w-20" /> : <p className="mt-1 font-display text-2xl font-bold text-ink-900 truncate">{value}</p>}
          {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
        </div>
        <div className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-xl ${ts.bg} ${ts.text}`}>{icon}</div>
      </div>
    </Card>
  );
}
