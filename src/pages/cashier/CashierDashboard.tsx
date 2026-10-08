import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { StatCard, Card, CardHeader } from '@/components/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { formatKsh, formatTime } from '@/lib/format';
import type { Shift, Sale } from '@/types';
import { TrendingUp, Receipt, Smartphone, Clock, AlertCircle, UtensilsCrossed, ShoppingBag } from 'lucide-react';

interface Props {
  shift: Shift;
  onNavigate: (view: string) => void;
}

export function CashierDashboard({ shift, onNavigate }: Props) {
  const { user } = useAuth();
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [shiftSales, setShiftSales] = useState<Sale[]>([]);
  const [openTabs, setOpenTabs] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayRes, shiftRes, tabsRes] = await Promise.all([
      supabase.from('sales').select('*').eq('cashier_id', user.id).gte('created_at', startOfDay.toISOString()).order('created_at', { ascending: false }),
      supabase.from('sales').select('*').eq('shift_id', shift.id).order('created_at', { ascending: false }),
      supabase.from('tabs').select('id', { count: 'exact', head: true }).eq('shift_id', shift.id).eq('status', 'open'),
    ]);

    setTodaySales((todayRes.data ?? []) as Sale[]);
    setShiftSales((shiftRes.data ?? []) as Sale[]);
    setOpenTabs(tabsRes.count ?? 0);
    setLoading(false);
  }, [user, shift.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const paidCount = shiftSales.filter((s) => s.payment_status === 'paid').length;
  const pendingCount = shiftSales.filter((s) => s.payment_status === 'pending').length;
  const failedCount = shiftSales.filter((s) => s.payment_status === 'failed').length;
  const todayTotal = todaySales.filter((s) => s.payment_status === 'paid').reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge tone="success">Shift Active</Badge>
          <span className="text-sm text-ink-500">Shift {shift.shift_number} · Opened {formatTime(shift.opening_time)}</span>
        </div>
        <button onClick={() => onNavigate('pos')} className="btn-primary">
          <ShoppingBag className="h-4 w-4" /> Start Selling
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's Sales" value={formatKsh(todayTotal)} icon={<TrendingUp className="h-5 w-5" />} tone="brand" loading={loading} />
        <StatCard label="Shift Sales" value={formatKsh(shift.gross_sales)} icon={<Receipt className="h-5 w-5" />} tone="success" loading={loading} />
        <StatCard label="Transactions" value={shift.transaction_count} icon={<Smartphone className="h-5 w-5" />} tone="info" loading={loading} />
        <StatCard label="Open Tabs" value={openTabs} icon={<UtensilsCrossed className="h-5 w-5" />} tone="accent" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="M-Pesa Completed" value={paidCount} icon={<Smartphone className="h-5 w-5" />} tone="success" loading={loading} />
        <StatCard label="Pending Payments" value={pendingCount} icon={<Clock className="h-5 w-5" />} tone="warning" loading={loading} />
        <StatCard label="Failed Payments" value={failedCount} icon={<AlertCircle className="h-5 w-5" />} tone="danger" loading={loading} />
      </div>

      <Card padding="md">
        <CardHeader title="Recent Sales" subtitle="Latest transactions this shift" icon={<Receipt className="h-5 w-5" />} action={
          <button onClick={() => onNavigate('sales')} className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</button>
        } />
        {shiftSales.length === 0 ? (
          <EmptyState icon={<Receipt className="h-7 w-7" />} title="No sales yet" message="Start selling from the POS to see transactions here." />
        ) : (
          <div className="space-y-2">
            {shiftSales.slice(0, 6).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3 transition hover:bg-ink-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{sale.receipt_number}</p>
                  <p className="text-xs text-ink-400">{formatTime(sale.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink-900">{formatKsh(sale.total)}</span>
                  <PaymentBadge status={sale.payment_status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    paid: { tone: 'success', label: 'Paid' },
    pending: { tone: 'warning', label: 'Pending' },
    failed: { tone: 'danger', label: 'Failed' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
    refunded: { tone: 'neutral', label: 'Refunded' },
    void: { tone: 'neutral', label: 'Void' },
  };
  const cfg = map[status] ?? { tone: 'neutral' as const, label: status };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
