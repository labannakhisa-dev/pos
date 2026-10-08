import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { openShift, getActiveShift } from '@/lib/sales';
import { formatTime } from '@/lib/format';
import { Clock, User, Calendar, Smartphone, Zap } from 'lucide-react';
import type { Shift } from '@/types';

export function OpenShift({ onOpened }: { onOpened: (shift: Shift) => void }) {
  const { user, staff } = useAuth();
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    getActiveShift(user.id).then((shift) => {
      if (shift) onOpened(shift);
      setChecking(false);
    });
  }, [user, onOpened]);

  const handleOpen = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const shift = await openShift(user.id, staff?.store_id ?? null);
      onOpened(shift);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open shift. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="skeleton h-8 w-48" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-ink-50 p-4">
      <div className="w-full max-w-lg animate-scale-in">
        <Card padding="lg">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-ink-900">Open Shift</h2>
              <p className="text-sm text-ink-500">You need an active shift to start selling</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <InfoRow icon={<User className="h-4 w-4" />} label="Cashier" value={staff?.full_name ?? '—'} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date" value={now.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
            <InfoRow icon={<Clock className="h-4 w-4" />} label="Current time" value={formatTime(now.toISOString())} />
            <InfoRow icon={<Smartphone className="h-4 w-4" />} label="Payment method" value="M-Pesa only" />
            <InfoRow icon={<Zap className="h-4 w-4" />} label="Opening cash" value="KSh 0.00" />
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-danger-50 border border-danger-100 px-3 py-2.5 text-sm text-danger-600">
              {error}
            </div>
          )}

          <Button onClick={handleOpen} size="lg" loading={loading} className="w-full">
            {loading ? 'Opening shift...' : 'Open Shift'}
          </Button>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink-50 px-4 py-3">
      <div className="flex items-center gap-2 text-ink-500">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-ink-900">{value}</span>
    </div>
  );
}
