import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UtensilsCrossed, Mail, Lock, ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error);
    setLoading(false);
  };

  const fillDemo = (em: string, pw: string) => {
    setEmail(em);
    setPassword(pw);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-ink-950 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 shadow-lg">
            <UtensilsCrossed className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Kirinyaga Healthcare Workers</h1>
          <p className="text-sm text-white/60">Cafeteria POS & Management System</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-pop animate-scale-in">
          <h2 className="mb-1 font-display text-xl font-bold text-ink-900">Sign In</h2>
          <p className="mb-5 text-sm text-ink-500">Enter your credentials to access the system</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@kirinyaga.health"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-4 w-4" />}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="rounded-lg bg-danger-50 border border-danger-100 px-3 py-2.5 text-sm text-danger-600">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-5 border-t border-ink-100 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Demo Accounts
            </p>
            <div className="space-y-1.5">
              <DemoAccount label="Super Admin" email="admin@kirinyaga.health" password="admin123" onClick={fillDemo} />
              <DemoAccount label="Cashier" email="jane@kirinyaga.health" password="cashier123" onClick={fillDemo} />
              <DemoAccount label="Storekeeper" email="store@kirinyaga.health" password="store123" onClick={fillDemo} />
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-white/40">M-Pesa only · No cash payments · Secure Daraja API integration</p>
      </div>
    </div>
  );
}

function DemoAccount({ label, email, password, onClick }: { label: string; email: string; password: string; onClick: (e: string, p: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(email, password)}
      className="flex w-full items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50"
    >
      <div>
        <p className="text-sm font-medium text-ink-800">{label}</p>
        <p className="text-xs text-ink-400">{email}</p>
      </div>
      <span className="text-xs font-mono text-ink-400">{password}</span>
    </button>
  );
}
