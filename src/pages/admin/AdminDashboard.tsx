import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { StatCard, Card, CardHeader } from '@/components/ui';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatKsh, formatTime } from '@/lib/format';
import type { Sale, Product } from '@/types';
import { TrendingUp, Smartphone, Receipt, Wallet, Truck, Package, AlertCircle, Users, Boxes } from 'lucide-react';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [todayPurchases, setTodayPurchases] = useState(0);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [activeCashiers, setActiveCashiers] = useState(0);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);

  const load = useCallback(async () => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const [salesRes, expRes, purRes, lowRes, shiftRes, itemsRes] = await Promise.all([
      supabase.from('sales').select('*').gte('created_at', startOfDay.toISOString()).order('created_at', { ascending: false }),
      supabase.from('expenses').select('amount').gte('created_at', startOfDay.toISOString()),
      supabase.from('purchases').select('total').gte('created_at', startOfDay.toISOString()),
      supabase.from('products').select('*').filter('current_stock', 'lte', 'min_stock').eq('status', 'active'),
      supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('sale_items').select('quantity, line_total, products(name)').order('quantity', { ascending: false }).limit(5),
    ]);

    setTodaySales((salesRes.data ?? []) as Sale[]);
    setTodayExpenses((expRes.data ?? []).reduce((s, e: { amount: number }) => s + e.amount, 0));
    setTodayPurchases((purRes.data ?? []).reduce((s, p: { total: number }) => s + p.total, 0));
    setLowStock((lowRes.data ?? []) as Product[]);
    setActiveCashiers(shiftRes.count ?? 0);

    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    (itemsRes.data ?? []).forEach((item: { quantity: number; line_total: number; products: { name: string } | null }) => {
      const name = item.products?.name ?? 'Unknown';
      const existing = productMap.get(name) ?? { name, qty: 0, revenue: 0 };
      existing.qty += item.quantity;
      existing.revenue += item.line_total;
      productMap.set(name, existing);
    });
    setTopProducts([...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5));
    setLoading(false);
  }, []);

  useEffect(() => { load(); const interval = setInterval(load, 10000); return () => clearInterval(interval); }, [load]);

  const paidSales = todaySales.filter((s) => s.payment_status === 'paid');
  const todayRevenue = paidSales.reduce((sum, s) => sum + s.total, 0);
  const grossProfit = paidSales.reduce((sum, s) => sum + (s.subtotal - s.sale_items?.reduce((c, i) => c + i.cost_price * i.quantity, 0) ?? 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-900">Admin Dashboard</h2>
        <p className="text-sm text-ink-500">Business overview · {new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's Sales" value={formatKsh(todayRevenue)} icon={<TrendingUp className="h-5 w-5" />} tone="brand" loading={loading} />
        <StatCard label="M-Pesa Sales" value={formatKsh(todayRevenue)} icon={<Smartphone className="h-5 w-5" />} tone="success" loading={loading} />
        <StatCard label="Transactions" value={paidSales.length} icon={<Receipt className="h-5 w-5" />} tone="info" loading={loading} />
        <StatCard label="Gross Profit" value={formatKsh(grossProfit)} icon={<TrendingUp className="h-5 w-5" />} tone="brand" loading={loading} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Expenses" value={formatKsh(todayExpenses)} icon={<Wallet className="h-5 w-5" />} tone="danger" loading={loading} />
        <StatCard label="Purchases" value={formatKsh(todayPurchases)} icon={<Truck className="h-5 w-5" />} tone="warning" loading={loading} />
        <StatCard label="Low Stock" value={lowStock.length} icon={<AlertCircle className="h-5 w-5" />} tone="warning" loading={loading} />
        <StatCard label="Active Cashiers" value={activeCashiers} icon={<Users className="h-5 w-5" />} tone="info" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="md">
          <CardHeader title="Top Products" subtitle="Best sellers today" icon={<Boxes className="h-5 w-5" />} />
          {topProducts.length === 0 ? <EmptyState icon={<Package className="h-7 w-7" />} title="No sales data yet" /> : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                    <span className="text-sm font-medium text-ink-900">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold">{p.qty} sold</span>
                    <p className="text-xs text-ink-400">{formatKsh(p.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="md">
          <CardHeader title="Low Stock Alerts" subtitle="Products at or below minimum" icon={<AlertCircle className="h-5 w-5" />} />
          {lowStock.length === 0 ? <EmptyState icon={<Package className="h-7 w-7" />} title="No low-stock products" message="All products are well stocked." /> : (
            <div className="space-y-2">
              {lowStock.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-2.5">
                  <div><p className="text-sm font-medium text-ink-900">{p.name}</p><p className="text-xs text-ink-400">{p.sku}</p></div>
                  <Badge tone="warning">{p.current_stock} {p.unit} left</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card padding="md">
        <CardHeader title="Recent Sales" subtitle="Latest transactions today" icon={<Receipt className="h-5 w-5" />} />
        {todaySales.length === 0 ? <EmptyState icon={<Receipt className="h-7 w-7" />} title="No sales today" /> : (
          <div className="space-y-2">
            {todaySales.slice(0, 8).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3">
                <div><p className="text-sm font-mono font-medium">{sale.receipt_number}</p><p className="text-xs text-ink-400">{formatTime(sale.created_at)}</p></div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatKsh(sale.total)}</span>
                  <Badge tone={sale.payment_status === 'paid' ? 'success' : sale.payment_status === 'pending' ? 'warning' : 'danger'}>{sale.payment_status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
