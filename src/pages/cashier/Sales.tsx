import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatKsh, formatDateTime } from '@/lib/format';
import type { Sale } from '@/types';
import { Receipt as ReceiptIcon, Printer, Download } from 'lucide-react';

export function Sales() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('sales').select('*, sale_items(*, products(*)), customers(*), restaurant_tables(*), payments(*)').eq('cashier_id', user.id).order('created_at', { ascending: false }).limit(100);
    setSales((data ?? []) as Sale[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Sale>[] = [
    { key: 'receipt_number', header: 'Receipt', render: (s) => <span className="font-mono text-sm font-medium">{s.receipt_number}</span> },
    { key: 'created_at', header: 'Date', render: (s) => <div><p className="text-sm">{formatDateTime(s.created_at)}</p></div> },
    { key: 'total', header: 'Total', render: (s) => <span className="font-semibold">{formatKsh(s.total)}</span> },
    { key: 'payment_status', header: 'Status', render: (s) => <StatusBadge status={s.payment_status} /> },
    { key: 'sale_type', header: 'Type', render: (s) => <Badge tone="neutral">{s.sale_type}</Badge> },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-900">My Sales</h2>
        <p className="text-sm text-ink-500">{sales.length} transactions</p>
      </div>

      <Card padding="md">
        <DataTable columns={columns} data={sales} loading={loading} onRowClick={setSelected}
          emptyTitle="No sales yet" emptyMessage="Your completed sales will appear here."
          emptyIcon={<ReceiptIcon className="h-7 w-7" />} />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.receipt_number ?? ''} subtitle="Receipt details" size="md"
        footer={selected?.payment_status === 'paid' ? (
          <>
            <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
            <Button onClick={() => downloadReceipt(selected)}><Download className="h-4 w-4" /> Download</Button>
          </>
        ) : undefined}
      >
        {selected && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-ink-500">Date</span><span>{formatDateTime(selected.created_at)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-ink-500">Status</span><StatusBadge status={selected.payment_status} /></div>
            <div className="flex justify-between text-sm"><span className="text-ink-500">Type</span><span className="capitalize">{selected.sale_type}</span></div>
            {selected.customers && <div className="flex justify-between text-sm"><span className="text-ink-500">Customer</span><span>{selected.customers.name}</span></div>}
            {selected.restaurant_tables && <div className="flex justify-between text-sm"><span className="text-ink-500">Table</span><span>{selected.restaurant_tables.table_number}</span></div>}
            <div className="border-t border-ink-100 pt-3">
              <p className="text-xs font-semibold uppercase text-ink-500 mb-2">Items</p>
              {selected.sale_items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm py-1.5">
                  <span>{item.products?.name ?? 'Unknown'} × {item.quantity}</span>
                  <span>{formatKsh(item.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-ink-100 pt-3 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-display text-xl font-bold">{formatKsh(selected.total)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
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

function downloadReceipt(sale: Sale) {
  const text = `KIRINYAGA HEALTHCARE WORKERS CAFETERIA\n\nReceipt: ${sale.receipt_number}\nDate: ${formatDateTime(sale.created_at)}\n\n${sale.sale_items?.map((i) => `${i.products?.name ?? ''} x${i.quantity} - ${formatKsh(i.line_total)}`).join('\n') ?? ''}\n\nTOTAL: ${formatKsh(sale.total)}\nPayment: M-Pesa (${sale.payment_status})\n\nThank you!`;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${sale.receipt_number}.txt`; a.click();
  URL.revokeObjectURL(url);
}
