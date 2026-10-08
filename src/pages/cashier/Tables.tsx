import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { POS } from './POS';
import { formatKsh, formatTime } from '@/lib/format';
import type { RestaurantTable, Tab, Shift } from '@/types';
import { UtensilsCrossed, Plus, ArrowRight, X } from 'lucide-react';

const statusConfig: Record<string, { tone: 'success' | 'warning' | 'danger' | 'neutral' | 'brand'; label: string; dot: string }> = {
  available: { tone: 'success', label: 'Available', dot: 'bg-success-500' },
  occupied: { tone: 'warning', label: 'Occupied', dot: 'bg-warning-500' },
  payment_pending: { tone: 'brand', label: 'Payment Pending', dot: 'bg-brand-500' },
  paid: { tone: 'neutral', label: 'Paid', dot: 'bg-ink-400' },
  closed: { tone: 'neutral', label: 'Closed', dot: 'bg-ink-300' },
};

export function Tables({ shift }: { shift: Shift }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [posForTab, setPosForTab] = useState<Tab | null>(null);

  const loadData = useCallback(async () => {
    const [tabRes, tableRes] = await Promise.all([
      supabase.from('tabs').select('*, restaurant_tables(*), customers(*), tab_items(*, products(*))').eq('shift_id', shift.id).neq('status', 'closed').order('created_at', { ascending: false }),
      supabase.from('restaurant_tables').select('*').order('table_number'),
    ]);
    setTabs((tabRes.data ?? []) as Tab[]);
    setTables((tableRes.data ?? []) as RestaurantTable[]);
    setLoading(false);
  }, [shift.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const openTab = async (table: RestaurantTable) => {
    if (!user) return;
    const { data, error } = await supabase.from('tabs').insert({
      table_id: table.id,
      shift_id: shift.id,
      status: 'open',
      total: 0,
      created_by: user.id,
    }).select('*, restaurant_tables(*), customers(*), tab_items(*, products(*))').single();
    if (error) { toast('Could not open tab for this table', 'error'); return; }
    await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id);
    setPosForTab(data as Tab);
    toast(`Tab opened for ${table.table_number}`, 'success');
    loadData();
  };

  const tabForTable = (tableId: string) => tabs.find((t) => t.table_id === tableId && t.status !== 'paid' && t.status !== 'closed');

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">Tables & Tabs</h2>
          <p className="text-sm text-ink-500">{tables.length} tables · {tabs.filter(t => t.status === 'open').length} open tabs</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-32 w-full" />)}
        </div>
      ) : tables.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed className="h-7 w-7" />} title="No tables set up" message="An admin needs to add restaurant tables first." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tables.map((table) => {
            const tab = tabForTable(table.id);
            const cfg = statusConfig[table.status] ?? statusConfig.available;
            return (
              <Card key={table.id} padding="md" className="transition hover:shadow-card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 font-display font-bold">
                    {table.table_number}
                  </div>
                  <Badge tone={cfg.tone}>
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
                  </Badge>
                </div>
                <p className="text-xs text-ink-400 mb-3">Capacity: {table.capacity} people</p>
                {tab ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-500">Tab total</span>
                      <span className="font-semibold text-ink-900">{formatKsh(tab.total)}</span>
                    </div>
                    <p className="text-xs text-ink-400">Opened {formatTime(tab.created_at)}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setActiveTab(tab)} className="flex-1">View</Button>
                      <Button size="sm" onClick={() => setPosForTab(tab)} className="flex-1"><Plus className="h-3.5 w-3.5" /> Add</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => openTab(table)} className="w-full" disabled={table.status !== 'available'}>
                    {table.status === 'available' ? 'Open Tab' : 'Unavailable'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Tab detail modal */}
      <Modal open={!!activeTab} onClose={() => setActiveTab(null)} title={`Tab · ${activeTab?.restaurant_tables?.table_number ?? '—'}`} subtitle={`Total: ${formatKsh(activeTab?.total ?? 0)}`} size="md"
        footer={activeTab ? (
          <>
            <Button variant="secondary" onClick={() => { setPosForTab(activeTab); setActiveTab(null); }}>Add Items</Button>
            <Button onClick={() => { setPosForTab(activeTab); setActiveTab(null); }}><ArrowRight className="h-4 w-4" /> Checkout</Button>
          </>
        ) : undefined}
      >
        {activeTab && (
          <div className="space-y-2">
            {activeTab.tab_items?.length === 0 ? (
              <EmptyState title="No items yet" message="Add products to this tab." />
            ) : (
              activeTab.tab_items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{item.products?.name ?? 'Unknown'}</p>
                    <p className="text-xs text-ink-400">{formatKsh(item.unit_price)} × {item.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatKsh(item.unit_price * item.quantity)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* POS for tab */}
      {posForTab && (
        <Modal open={!!posForTab} onClose={() => setPosForTab(null)} title={`Add items · ${posForTab.restaurant_tables?.table_number ?? ''}`} size="xl">
          <POS shift={shift} saleType="table" presetTableId={posForTab.table_id} presetTabId={posForTab.id} onComplete={() => { setPosForTab(null); loadData(); }} />
        </Modal>
      )}
    </div>
  );
}
