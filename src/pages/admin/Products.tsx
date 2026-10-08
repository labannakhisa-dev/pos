import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { formatKsh } from '@/lib/format';
import type { Product, Category, Supplier } from '@/types';
import { Package, Plus, Search, Pencil, AlertCircle } from 'lucide-react';

export function Products() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', sku: '', barcode: '', category_id: '', buying_price: '', selling_price: '', current_stock: '', min_stock: '', unit: 'pcs', supplier_id: '', description: '', status: 'active' as 'active' | 'inactive' });

  const load = useCallback(async () => {
    let q = supabase.from('products').select('*, categories(*)').order('name');
    if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    const [prodRes, catRes, supRes] = await Promise.all([
      q.limit(200),
      supabase.from('categories').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ]);
    setProducts((prodRes.data ?? []) as Product[]);
    setCategories((catRes.data ?? []) as Category[]);
    setSuppliers((supRes.data ?? []) as Supplier[]);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ name: '', sku: '', barcode: '', category_id: '', buying_price: '', selling_price: '', current_stock: '', min_stock: '', unit: 'pcs', supplier_id: '', description: '', status: 'active' }); setModalOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm({ name: p.name, sku: p.sku, barcode: p.barcode ?? '', category_id: p.category_id ?? '', buying_price: String(p.buying_price), selling_price: String(p.selling_price), current_stock: String(p.current_stock), min_stock: String(p.min_stock), unit: p.unit, supplier_id: p.supplier_id ?? '', description: p.description ?? '', status: p.status }); setModalOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.sku.trim()) { toast('Name and SKU are required', 'error'); return; }
    const payload = {
      name: form.name.trim(), sku: form.sku.trim().toUpperCase(), barcode: form.barcode.trim() || null,
      category_id: form.category_id || null,
      buying_price: parseFloat(form.buying_price) || 0, selling_price: parseFloat(form.selling_price) || 0,
      current_stock: parseFloat(form.current_stock) || 0, min_stock: parseFloat(form.min_stock) || 0,
      unit: form.unit, supplier_id: form.supplier_id || null, description: form.description.trim() || null,
      status: form.status,
    };
    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) { toast(error.message.includes('duplicate') ? 'SKU already exists' : 'Could not update product', 'error'); return; }
      toast('Product updated', 'success');
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) { toast(error.message.includes('duplicate') ? 'SKU already exists' : 'Could not add product', 'error'); return; }
      toast('Product added', 'success');
    }
    setModalOpen(false); load();
  };

  const columns: Column<Product>[] = [
    { key: 'name', header: 'Product', render: (p) => <div><p className="font-medium text-ink-900">{p.name}</p><p className="text-xs text-ink-400">{p.sku}</p></div> },
    { key: 'category', header: 'Category', render: (p) => p.categories?.name ?? '—' },
    { key: 'selling_price', header: 'Price', render: (p) => formatKsh(p.selling_price) },
    { key: 'current_stock', header: 'Stock', render: (p) => (
      <span className={p.current_stock <= 0 ? 'text-danger-500 font-medium' : p.current_stock <= p.min_stock ? 'text-warning-600 font-medium' : 'text-ink-700'}>
        {p.current_stock} {p.unit}
      </span>
    )},
    { key: 'status', header: 'Status', render: (p) => <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>{p.status}</Badge> },
    { key: 'actions', header: '', render: (p) => <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="text-ink-400 hover:text-brand-600 transition"><Pencil className="h-4 w-4" /></button> },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-bold text-ink-900">Products</h2><p className="text-sm text-ink-500">{products.length} products</p></div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Product</Button>
      </div>

      <Card padding="md">
        <div className="mb-4"><Input placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} /></div>
        <DataTable columns={columns} data={products} loading={loading} onRowClick={openEdit}
          emptyTitle="No products yet" emptyMessage="Add your first product to start selling."
          emptyIcon={<Package className="h-7 w-7" />} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'Add Product'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save}>{editing ? 'Update' : 'Add Product'}</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Masala Tea" /></div>
          <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="BEV-001" />
          <Input label="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="6001000001" />
          <Select label="Category" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
            <option value="">No supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Buying price (KSh)" type="number" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} />
          <Input label="Selling price (KSh)" type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
          <Input label="Current stock" type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
          <Input label="Min stock" type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
          <Input label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs, cup, plate" />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}>
            <option value="active">Active</option><option value="inactive">Inactive</option>
          </Select>
          <div className="col-span-2"><Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
        </div>
      </Modal>
    </div>
  );
}
