import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', ...rest }, ref) => (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">{icon}</div>}
        <input ref={ref} className={`input ${icon ? 'pl-10' : ''} ${error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-100' : ''} ${className}`} {...rest} />
      </div>
      {error ? <p className="mt-1 text-xs text-danger-600">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  ),
);
Input.displayName = 'Input';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, children, className = '', ...rest }, ref) => (
    <div>
      {label && <label className="label">{label}</label>}
      <select ref={ref} className={`input appearance-none bg-no-repeat pr-9 ${error ? 'border-danger-500' : ''} ${className}`}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2366718d' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: 'right 0.75rem center' }}
        {...rest}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...rest }, ref) => (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea ref={ref} className={`input ${error ? 'border-danger-500' : ''} ${className}`} {...rest} />
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  ),
);
Textarea.displayName = 'Textarea';
