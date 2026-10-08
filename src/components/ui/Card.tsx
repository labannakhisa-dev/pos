import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const padClasses = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  return <div className={`card ${padClasses[padding]} ${className}`}>{children}</div>;
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && <div className="shrink-0 text-brand-600">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-ink-900 truncate">{title}</h3>
          {subtitle && <p className="text-sm text-ink-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
