import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { formatKsh, formatDate, formatTimeAgo } from '@/lib/format';
import type { Customer, CustomerType } from '@/types';
import { Users, Plus, Search, Phone, Mail } from 'lucide-react';

export function Customers() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', employee_number: '', customer_type: 'walk_in' as CustomerType, notes: '' });

  const load = useCallback(async () => {
    let q = supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,employee_number.ilike.%${search}%`);
    const { data } = await q.limit(100);
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ name: '', phone: '', employee_number: '', customer_type: 'walk_in', notes: '' }); setModalOpen(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, phone: c.phone ?? '', employee_number: c.employee_number ?? '', customer_type: c.customer_type, notes: c.notes ?? '' }); setModalOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast('Customer name is required', 'error'); return; }
    const payload = { name: form.name.trim(), phone: form.phone.trim() || null, employee_number: form.employee_number.trim() || null, customer_type: form.customer_type, notes: form.notes.trim() || null };
    if (editing) {
      const { error } = await supabase.from('customers').update(payload).eq('id', editing.id);
      if (error) { toast('Could not update customer', 'error'); return; }
      toast('Customer updated', 'success');
    } else {
      const { error } = await supabase.from('customers').insert(payload);
      if (error) { toast('Could not add customer', 'error'); return; }
      toast('Customer added', 'success');
    }
    setModalOpen(false);
    load();
  };

  const columns: Column<Customer>[] = [
    { key: 'name', header: 'Name', render: (c) => (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{c.name.charAt(0)}</div>
        <div><p className="font-medium text-ink-900">{c.name}</p><p className="text-xs text-ink-400">{c.employee_number ?? 'No emp. number'}</p></div>
      </div>
    )},
    { key: 'phone', header: 'Phone', render: (c) => c.phone ?? '—' },
    { key: 'customer_type', header: 'Type', render: (c) => <Badge tone="neutral">{c.customer_type}</Badge> },
    { key: 'total_spending', header: 'Total Spending', render: (c) => formatKsh(c.total_spending) },
    { key: 'last_purchase_at', header: 'Last Purchase', render: (c) => c.last_purchase_at ? formatTimeAgo(c.last_purchase_at) : 'Never' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">Customers</h2>
          <p className="text-sm text-ink-500">{customers.length} customers</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Customer</Button>
      </div>

      <Card padding="md">
        <div className="mb-4">
          <Input placeholder="Search by name, phone, or employee number..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
        </div>
        <DataTable columns={columns} data={customers} loading={loading} onRowClick={openEdit}
          emptyTitle="No customers yet" emptyMessage="Add your first customer to track their purchases."
          emptyIcon={<Users className="h-7 w-7" />} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'} size="md"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save}>{editing ? 'Update' : 'Add'}</Button></>}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Patient" />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07XXXXXXXX" icon={<Phone className="h-4 w-4" />} />
          <Input label="Employee number" value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} placeholder="e.g. KCH-045" />
          <Select label="Customer type" value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value as CustomerType })}>
            <option value="walk_in">Walk-in</option>
            <option value="staff">Staff</option>
            <option value="student">Student</option>
            <option value="visitor">Visitor</option>
            <option value="other">Other</option>
          </Select>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
