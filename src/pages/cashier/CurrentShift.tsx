import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { formatKsh, formatTime, formatDateTime } from '@/lib/format';
import type { Shift, Sale } from '@/types';
import { Clock, TrendingUp, Smartphone, Receipt, AlertCircle } from 'lucide-react';

export function CurrentShift({ shift }: { shift: Shift }) {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [liveShift, setLiveShift] = useState<Shift>(shift);

  const load = useCallback(async () => {
    if (!user) return;
    const [salesRes, shiftRes] = await Promise.all([
      supabase.from('sales').select('*').eq('shift_id', shift.id).order('created_at', { ascending: false }),
      supabase.from('shifts').select('*').eq('id', shift.id).maybeSingle(),
    ]);
    setSales((salesRes.data ?? []) as Sale[]);
    if (shiftRes.data) setLiveShift(shiftRes.data as Shift);
  }, [user, shift.id]);

  useEffect(() => { load(); const interval = setInterval(load, 5000); return () => clearInterval(interval); }, [load]);

  const paid = sales.filter((s) => s.payment_status === 'paid');
  const pending = sales.filter((s) => s.payment_status === 'pending');
  const failed = sales.filter((s) => s.payment_status === 'failed');

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">Current Shift</h2>
          <p className="text-sm text-ink-500">{liveShift.shift_number} · {formatDateTime(liveShift.opening_time)}</p>
        </div>
        <Badge tone="success">Active</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Gross Sales" value={formatKsh(liveShift.gross_sales)} icon={<TrendingUp className="h-5 w-5" />} tone="brand" />
        <StatCard label="M-Pesa Sales" value={formatKsh(liveShift.mpesa_sales)} icon={<Smartphone className="h-5 w-5" />} tone="success" />
        <StatCard label="Transactions" value={liveShift.transaction_count} icon={<Receipt className="h-5 w-5" />} tone="info" />
        <StatCard label="Net Sales" value={formatKsh(liveShift.net_sales)} icon={<TrendingUp className="h-5 w-5" />} tone="brand" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="Paid" value={paid.length} icon={<Smartphone className="h-5 w-5" />} tone="success" />
        <StatCard label="Pending" value={pending.length} icon={<Clock className="h-5 w-5" />} tone="warning" />
        <StatCard label="Failed" value={failed.length} icon={<AlertCircle className="h-5 w-5" />} tone="danger" />
      </div>

      <Card padding="md">
        <CardHeader title="Shift Details" icon={<Clock className="h-5 w-5" />} />
        <div className="grid grid-cols-2 gap-4 text-sm">
          <DetailRow label="Opening time" value={formatTime(liveShift.opening_time)} />
          <DetailRow label="Opening cash" value={formatKsh(0)} />
          <DetailRow label="Cash sales" value={formatKsh(liveShift.cash_sales)} />
          <DetailRow label="Refunds" value={formatKsh(liveShift.refunds)} />
        </div>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-ink-500 uppercase font-semibold">{label}</p><p className="mt-0.5 font-medium text-ink-900">{value}</p></div>;
}
