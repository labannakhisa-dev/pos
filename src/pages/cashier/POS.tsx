import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatKsh, normalizePhone } from '@/lib/format';
import type { Product, Category, CartItem, Customer, Shift, MpesaTransaction } from '@/types';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, Smartphone, Loader2,
  CheckCircle2, XCircle, User, Package, AlertTriangle,
} from 'lucide-react';

interface Props {
  shift: Shift;
  saleType?: 'pos' | 'quick' | 'table';
  presetTableId?: string | null;
  presetTabId?: string | null;
  onComplete?: () => void;
}

export function POS({ shift, saleType = 'pos', presetTableId = null, presetTabId = null, onComplete }: Props) {
  const { user, staff } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [payState, setPayState] = useState<'idle' | 'initiating' | 'waiting' | 'success' | 'failed'>('idle');
  const [payMessage, setPayMessage] = useState<string>('');
  const [currentMpesaTx, setCurrentMpesaTx] = useState<MpesaTransaction | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const loadData = useCallback(async () => {
    const [prodRes, catRes, custRes] = await Promise.all([
      supabase.from('products').select('*, categories(*)').eq('status', 'active').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setProducts((prodRes.data ?? []) as Product[]);
    setCategories((catRes.data ?? []) as Category[]);
    setCustomers((custRes.data ?? []) as Customer[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll for payment status when waiting
  useEffect(() => {
    if (payState !== 'waiting' || !currentMpesaTx) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase.from('mpesa_transactions').select('*').eq('id', currentMpesaTx.id).maybeSingle();
      const tx = data as MpesaTransaction | null;
      if (!tx) return;
      if (tx.status === 'success') {
        clearInterval(interval);
        setPayState('success');
        setPayMessage('Payment confirmed successfully!');
        await completeSale(tx);
      } else if (tx.status === 'failed') {
        clearInterval(interval);
        setPayState('failed');
        setPayMessage(tx.result_desc ?? 'Payment failed. Please try again.');
      } else if (attempts > 60) {
        clearInterval(interval);
        setPayState('failed');
        setPayMessage('Payment timed out. The customer did not respond in time.');
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [payState, currentMpesaTx]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory && p.category_id !== activeCategory) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, activeCategory, search]);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: Product) => {
    if (product.current_stock <= 0 && !product.allow_negative_inventory) {
      toast(`${product.name} is out of stock`, 'warning');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock && !product.allow_negative_inventory) {
          toast(`Only ${product.current_stock} ${product.unit} of ${product.name} available`, 'warning');
          return prev;
        }
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => prev.map((item) => {
      if (item.product.id !== productId) return item;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return item;
      if (newQty > item.product.current_stock && !item.product.allow_negative_inventory) {
        toast(`Only ${item.product.current_stock} ${item.product.unit} available`, 'warning');
        return item;
      }
      return { ...item, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setPhone('');
    setPayState('idle');
    setCurrentMpesaTx(null);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setCheckoutOpen(true);
    if (selectedCustomer?.phone) setPhone(selectedCustomer.phone);
  };

  const handlePay = async () => {
    if (!user) return;
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setPhoneError('Enter a valid Safaricom number (e.g. 0712345678 or 254712345678)');
      return;
    }
    setPhoneError(null);
    setPayState('initiating');
    setPayMessage('');

    try {
      const { createSale, createPayment, initiateStkPush } = await import('@/lib/sales');

      const { sale } = await createSale({
        shiftId: shift.id,
        cashierId: user.id,
        storeId: staff?.store_id ?? null,
        cart,
        customerId: selectedCustomer?.id ?? null,
        tableId: presetTableId,
        tabId: presetTabId,
        saleType,
      });

      const { mpesaTx } = await createPayment({
        saleId: sale.id,
        amount: cartTotal,
        phone: normalized,
        cashierId: user.id,
      });

      setCurrentMpesaTx(mpesaTx);

      try {
        const result = await initiateStkPush({
          mpesaTransactionId: mpesaTx.id,
          phone: normalized,
          amount: cartTotal,
          saleId: sale.id,
        });
        setPayState('waiting');
        setPayMessage(result.customerMessage);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'STK Push failed';
        if (msg.includes('not configured')) {
          setPayState('failed');
          setPayMessage('M-Pesa is not configured. An admin must set Daraja credentials in M-Pesa settings. The sale is saved as pending — retry once configured.');
        } else {
          setPayState('failed');
          setPayMessage(msg);
        }
      }
    } catch (err) {
      setPayState('failed');
      setPayMessage(err instanceof Error ? err.message : 'Unable to complete sale.');
    }
  };

  const completeSale = async (mpesaTx: MpesaTransaction) => {
    if (!user) return;
    const { completeSaleOnPayment } = await import('@/lib/sales');
    await completeSaleOnPayment({
      saleId: (mpesaTx as MpesaTransaction & { sale_id: string }).sale_id,
      shiftId: shift.id,
      cashierId: user.id,
      cart,
      mpesaTransaction: mpesaTx,
      customerId: selectedCustomer?.id ?? null,
      tableId: presetTableId,
      tabId: presetTabId,
    });
    toast('Sale completed successfully!', 'success');
    setTimeout(() => {
      clearCart();
      setCheckoutOpen(false);
      onComplete?.();
    }, 2000);
  };

  const filteredCustomers = customers.filter((c) =>
    !customerSearch ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone ?? '').includes(customerSearch) ||
    (c.employee_number ?? '').toLowerCase().includes(customerSearch.toLowerCase()),
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full animate-fade-in">
      {/* Product grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-3 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input placeholder="Search products by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
          </div>
        </div>

        <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          <button onClick={() => setActiveCategory(null)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${!activeCategory ? 'bg-brand-600 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
            All
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${activeCategory === cat.id ? 'bg-brand-600 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
              {cat.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-40 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Package className="h-7 w-7" />} title="No products found" message="Try a different search or category." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto scrollbar-thin pb-4">
            {filtered.map((product) => {
              const outOfStock = product.current_stock <= 0 && !product.allow_negative_inventory;
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={outOfStock}
                  className={`group flex flex-col rounded-xl border bg-white p-3 text-left transition ${outOfStock ? 'opacity-50 cursor-not-allowed border-ink-200' : 'border-ink-200 hover:border-brand-300 hover:shadow-card-hover active:scale-[0.98]'}`}
                >
                  <div className="mb-2 flex h-20 items-center justify-center rounded-lg bg-ink-50 text-ink-300">
                    {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover rounded-lg" /> : <Package className="h-8 w-8" />}
                  </div>
                  <p className="truncate text-sm font-semibold text-ink-900">{product.name}</p>
                  <p className="text-xs text-ink-400">{product.categories?.name ?? 'Uncategorized'}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-sm font-bold text-brand-600">{formatKsh(product.selling_price)}</span>
                    <span className={`text-xs ${outOfStock ? 'text-danger-500' : product.current_stock <= product.min_stock ? 'text-warning-600' : 'text-ink-400'}`}>
                      {outOfStock ? 'Out of stock' : `${product.current_stock} ${product.unit}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart sidebar */}
      <div className="w-full lg:w-96 shrink-0 flex flex-col">
        <div className="card flex flex-col h-full max-h-[calc(100vh-8rem)]">
          <div className="flex items-center justify-between p-4 border-b border-ink-100">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-brand-600" />
              <h3 className="font-display font-semibold text-ink-900">Cart</h3>
              {cartCount > 0 && <Badge tone="brand">{cartCount}</Badge>}
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-ink-400 hover:text-danger-500 transition">Clear</button>
            )}
          </div>

          {/* Customer selector */}
          <div className="px-4 py-3 border-b border-ink-100">
            <button onClick={() => setCustomerSearchOpen(true)} className="flex w-full items-center gap-2 rounded-lg bg-ink-50 px-3 py-2.5 text-left transition hover:bg-ink-100">
              <User className="h-4 w-4 text-ink-400" />
              <span className="flex-1 text-sm text-ink-600 truncate">{selectedCustomer ? selectedCustomer.name : 'Walk-in customer'}</span>
            </button>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
            {cart.length === 0 ? (
              <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Cart is empty" message="Tap products to add them." />
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-2 rounded-lg border border-ink-100 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{item.product.name}</p>
                      <p className="text-xs text-ink-400">{formatKsh(item.product.selling_price)} × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.product.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-100 text-ink-600 hover:bg-ink-200 transition">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-100 text-ink-600 hover:bg-ink-200 transition">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removeFromCart(item.product.id)} className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-danger-500 hover:bg-danger-50 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total + checkout */}
          <div className="border-t border-ink-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-500">Total</span>
              <span className="font-display text-2xl font-bold text-ink-900">{formatKsh(cartTotal)}</span>
            </div>
            <Button onClick={handleCheckout} disabled={cart.length === 0} size="lg" className="w-full">
              <Smartphone className="h-5 w-5" /> Checkout · M-Pesa
            </Button>
          </div>
        </div>
      </div>

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => payState === 'idle' || payState === 'failed' ? setCheckoutOpen(false) : undefined} title="M-Pesa Payment" subtitle={`${formatKsh(cartTotal)} · ${cartCount} item(s)`} size="md"
        footer={payState === 'idle' || payState === 'failed' ? (
          <>
            <Button variant="secondary" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button onClick={handlePay} loading={payState === 'initiating'} disabled={payState === 'initiating'}>
              <Smartphone className="h-4 w-4" /> Send STK Push
            </Button>
          </>
        ) : undefined}
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-brand-50 border border-brand-100 p-3 flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-brand-600" />
            <div>
              <p className="text-sm font-semibold text-brand-800">M-Pesa STK Push</p>
              <p className="text-xs text-brand-600">Customer receives a prompt on their phone to enter M-Pesa PIN</p>
            </div>
          </div>

          {payState === 'idle' || payState === 'initiating' || payState === 'failed' ? (
            <Input label="Customer phone number" type="tel" placeholder="0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} icon={<Smartphone className="h-4 w-4" />} error={phoneError ?? undefined} hint="Format: 07XXXXXXXX or 2547XXXXXXXX" disabled={payState === 'initiating'} />
          ) : null}

          {payState === 'waiting' && (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-200" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                </div>
              </div>
              <p className="font-display font-semibold text-ink-900">Waiting for payment...</p>
              <p className="mt-1 text-sm text-ink-500">{payMessage}</p>
              <p className="mt-2 text-xs text-ink-400">Customer must enter their M-Pesa PIN on their phone</p>
            </div>
          )}

          {payState === 'success' && (
            <div className="flex flex-col items-center py-6 text-center animate-scale-in">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
                <CheckCircle2 className="h-8 w-8 text-success-600" />
              </div>
              <p className="font-display font-semibold text-ink-900">Payment Successful!</p>
              <p className="mt-1 text-sm text-ink-500">{payMessage}</p>
            </div>
          )}

          {payState === 'failed' && (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-100">
                <XCircle className="h-8 w-8 text-danger-600" />
              </div>
              <p className="font-display font-semibold text-ink-900">Payment Failed</p>
              <p className="mt-1 text-sm text-ink-500 max-w-xs">{payMessage}</p>
              <p className="mt-2 text-xs text-ink-400 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> No duplicate sale was created. You can retry safely.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Customer search modal */}
      <Modal open={customerSearchOpen} onClose={() => setCustomerSearchOpen(false)} title="Select Customer" size="md">
        <Input placeholder="Search by name, phone, or employee number..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
        <div className="mt-3 space-y-1.5 max-h-80 overflow-y-auto scrollbar-thin">
          <button onClick={() => { setSelectedCustomer(null); setCustomerSearchOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-ink-50">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100"><User className="h-4 w-4 text-ink-400" /></div>
            <div><p className="text-sm font-medium text-ink-800">Walk-in customer</p><p className="text-xs text-ink-400">No customer record</p></div>
          </button>
          {filteredCustomers.map((c) => (
            <button key={c.id} onClick={() => { setSelectedCustomer(c); setPhone(c.phone ?? ''); setCustomerSearchOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-ink-50">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{c.name.charAt(0)}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-800">{c.name}</p>
                <p className="text-xs text-ink-400">{c.phone ?? 'No phone'} · {c.customer_type}</p>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
