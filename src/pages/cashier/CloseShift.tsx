import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatKsh, formatTime, formatDateTime } from '@/lib/format';
import type { Shift } from '@/types';
import { closeShift } from '@/lib/sales';
import { Lock, TrendingUp, Smartphone, Receipt, AlertCircle, CheckCircle2 } from 'lucide-react';

export function CloseShift({ shift, onClosed }: { shift: Shift; onClosed: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [liveShift, setLiveShift] = useState<Shift>(shift);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('shifts').select('*').eq('id', shift.id).maybeSingle();
    if (data) setLiveShift(data as Shift);
  }, [shift.id]);

  useEffect(() => { load(); }, [load]);

  const handleClose = async () => {
    setClosing(true);
    try {
      await closeShift(shift.id);
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'shift.closed',
          entity: 'shift',
          entity_id: shift.id,
          new_value: { shift_number: shift.shift_number, gross_sales: liveShift.gross_sales },
        });
      }
      toast('Shift closed successfully', 'success');
      onClosed();
    } catch (err) {
      toast('Could not close shift. Please try again.', 'error');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-900">Close Shift</h2>
        <p className="text-sm text-ink-500">Review your shift summary before closing</p>
      </div>

      <Card padding="lg">
        <div className="mb-5 rounded-xl bg-brand-50 border border-brand-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white"><Lock className="h-5 w-5" /></div>
            <div>
              <p className="font-display font-semibold text-brand-800">Shift {liveShift.shift_number}</p>
              <p className="text-sm text-brand-600">{formatDateTime(liveShift.opening_time)} — now</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SummaryRow icon={<Receipt className="h-4 w-4" />} label="Transactions" value={String(liveShift.transaction_count)} />
          <SummaryRow icon={<TrendingUp className="h-4 w-4" />} label="Gross Sales" value={formatKsh(liveShift.gross_sales)} />
          <SummaryRow icon={<Smartphone className="h-4 w-4" />} label="M-Pesa Sales" value={formatKsh(liveShift.mpesa_sales)} />
          <SummaryRow icon={<Smartphone className="h-4 w-4" />} label="Cash Sales" value={formatKsh(0)} highlight="Cash total must always be KSh 0 (M-Pesa only)" />
          <SummaryRow icon={<AlertCircle className="h-4 w-4" />} label="Failed Payments" value={String(liveShift.failed_payments)} />
          <SummaryRow icon={<Receipt className="h-4 w-4" />} label="Net Sales" value={formatKsh(liveShift.net_sales)} />
        </div>

        <div className="mt-5 border-t border-ink-100 pt-5">
          <Button onClick={() => setConfirmOpen(true)} size="lg" variant="danger" className="w-full">
            <Lock className="h-5 w-5" /> Close Shift
          </Button>
        </div>
      </Card>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Close Shift" size="sm"
        footer={<><Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button variant="danger" onClick={handleClose} loading={closing}><Lock className="h-4 w-4" /> Close Shift</Button></>}>
        <div className="text-center py-2">
          <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-warning-100"><AlertTriangle className="h-6 w-6 text-warning-600" /></div>
          <p className="text-sm text-ink-700">Are you sure you want to close this shift? This action cannot be undone. You will need to open a new shift to continue selling.</p>
          <div className="mt-4 rounded-lg bg-ink-50 p-3 text-left">
            <div className="flex justify-between text-sm"><span className="text-ink-500">Total sales</span><span className="font-semibold">{formatKsh(liveShift.gross_sales)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-ink-500">Transactions</span><span className="font-semibold">{liveShift.transaction_count}</span></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SummaryRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3">
      <div className="flex items-center gap-2 text-ink-500">{icon}<span className="text-sm font-medium">{label}</span></div>
      <div className="text-right">
        <span className="text-sm font-semibold text-ink-900">{value}</span>
        {highlight && <p className="text-xs text-ink-400">{highlight}</p>}
      </div>
    </div>
  );
}

function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
