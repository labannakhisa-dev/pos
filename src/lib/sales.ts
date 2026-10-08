import { supabase } from '@/lib/supabase';
import type { CartItem, Sale, SaleItem, Shift, Payment, MpesaTransaction } from '@/types';

export async function getActiveShift(cashierId: string): Promise<Shift | null> {
  const { data } = await supabase
    .from('shifts')
    .select('*')
    .eq('cashier_id', cashierId)
    .eq('status', 'open')
    .order('opening_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as Shift | null;
}

export async function openShift(cashierId: string, storeId: string | null, deviceInfo?: string): Promise<Shift> {
  const { data: shiftNumber } = await supabase.rpc('next_shift_number').single();
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      cashier_id: cashierId,
      store_id: storeId,
      shift_number: shiftNumber,
      opening_cash: 0,
      device_info: deviceInfo ?? navigator.userAgent.slice(0, 200),
      status: 'open',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Shift;
}

export async function closeShift(shiftId: string): Promise<void> {
  const { error } = await supabase
    .from('shifts')
    .update({ status: 'closed', closing_time: new Date().toISOString() })
    .eq('id', shiftId);
  if (error) throw new Error(error.message);
}

export async function createSale(params: {
  shiftId: string;
  cashierId: string;
  storeId: string | null;
  cart: CartItem[];
  customerId?: string | null;
  tableId?: string | null;
  tabId?: string | null;
  saleType: 'pos' | 'quick' | 'table';
  notes?: string;
}): Promise<{ sale: Sale; saleItems: SaleItem[] }> {
  const { shiftId, cashierId, storeId, cart, customerId = null, tableId = null, tabId = null, saleType, notes } = params;

  const subtotal = cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0);
  const total = subtotal;

  const { data: receiptNumber } = await supabase.rpc('next_receipt_number').single();

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      receipt_number: receiptNumber,
      shift_id: shiftId,
      cashier_id: cashierId,
      customer_id: customerId,
      table_id: tableId,
      tab_id: tabId,
      store_id: storeId,
      subtotal,
      total,
      payment_status: 'pending',
      sale_type: saleType,
      notes: notes ?? null,
      created_by: cashierId,
    })
    .select()
    .single();
  if (saleError) throw new Error(saleError.message);

  const saleItemsData = cart.map((item) => ({
    sale_id: sale.id,
    product_id: item.product.id,
    quantity: item.quantity,
    unit_price: item.product.selling_price,
    cost_price: item.product.buying_price,
    line_total: item.product.selling_price * item.quantity,
  }));

  const { data: saleItems, error: itemsError } = await supabase.from('sale_items').insert(saleItemsData).select();
  if (itemsError) throw new Error(itemsError.message);

  return { sale: sale as Sale, saleItems: saleItems as SaleItem[] };
}

export async function createPayment(params: {
  saleId: string;
  amount: number;
  phone: string;
  cashierId: string;
}): Promise<{ payment: Payment; mpesaTx: MpesaTransaction }> {
  const { saleId, amount, phone, cashierId } = params;

  const { data: payment, error: payError } = await supabase
    .from('payments')
    .insert({
      sale_id: saleId,
      amount,
      payment_method: 'mpesa',
      status: 'initiated',
      phone,
      created_by: cashierId,
    })
    .select()
    .single();
  if (payError) throw new Error(payError.message);

  const { data: mpesaTx, error: mpesaError } = await supabase
    .from('mpesa_transactions')
    .insert({
      sale_id: saleId,
      payment_id: payment.id,
      phone,
      amount,
      payment_type: 'stk_push',
      status: 'initiated',
      reconciliation_status: 'pending',
      created_by: cashierId,
    })
    .select()
    .single();
  if (mpesaError) throw new Error(mpesaError.message);

  await supabase.from('payments').update({ mpesa_transaction_id: mpesaTx.id }).eq('id', payment.id);

  return { payment: payment as Payment, mpesaTx: mpesaTx as MpesaTransaction };
}

export async function initiateStkPush(params: {
  mpesaTransactionId: string;
  phone: string;
  amount: number;
  saleId: string;
}): Promise<{ checkoutRequestId: string; merchantRequestId: string; customerMessage: string }> {
  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-stk-push`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      mpesa_transaction_id: params.mpesaTransactionId,
      phone: params.phone,
      amount: params.amount,
      sale_id: params.saleId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `STK Push failed (${response.status})`);
  }

  return {
    checkoutRequestId: data.checkout_request_id,
    merchantRequestId: data.merchant_request_id,
    customerMessage: data.customer_message ?? 'STK Push sent. Check your phone.',
  };
}

export async function pollPaymentStatus(mpesaTransactionId: string): Promise<MpesaTransaction | null> {
  const { data } = await supabase
    .from('mpesa_transactions')
    .select('*')
    .eq('id', mpesaTransactionId)
    .maybeSingle();
  return data as MpesaTransaction | null;
}

export async function completeSaleOnPayment(params: {
  saleId: string;
  shiftId: string;
  cashierId: string;
  cart: CartItem[];
  mpesaTransaction: MpesaTransaction;
  customerId?: string | null;
  tableId?: string | null;
  tabId?: string | null;
}): Promise<void> {
  const { saleId, shiftId, cashierId, cart, mpesaTransaction, customerId = null, tableId = null, tabId = null } = params;
  const total = cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0);

  // Mark sale as paid
  const { error: saleErr } = await supabase
    .from('sales')
    .update({ payment_status: 'paid' })
    .eq('id', saleId);
  if (saleErr) throw new Error(saleErr.message);

  // Mark payment success
  await supabase
    .from('payments')
    .update({ status: 'success', mpesa_transaction_id: mpesaTransaction.id })
    .eq('sale_id', saleId);

  // Update mpesa transaction
  await supabase
    .from('mpesa_transactions')
    .update({
      status: 'success',
      result_code: 0,
      result_desc: 'Success',
      reconciliation_status: 'matched',
      mpesa_receipt_number: mpesaTransaction.mpesa_receipt_number,
    })
    .eq('id', mpesaTransaction.id);

  // Reduce inventory + record movements
  for (const item of cart) {
    const { data: product } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', item.product.id)
      .maybeSingle();

    const prevQty = product?.current_stock ?? 0;
    const newQty = prevQty - item.quantity;

    await supabase.from('products').update({ current_stock: newQty }).eq('id', item.product.id);

    await supabase.from('inventory_movements').insert({
      product_id: item.product.id,
      movement_type: 'sale',
      quantity_change: -item.quantity,
      previous_quantity: prevQty,
      new_quantity: newQty,
      reason: `Sale ${mpesaTransaction.mpesa_receipt_number ?? saleId.slice(0, 8)}`,
      reference_type: 'sale',
      reference_id: saleId,
      user_id: cashierId,
    });
  }

  // Update shift totals
  const { data: shift } = await supabase.from('shifts').select('*').eq('id', shiftId).maybeSingle();
  if (shift) {
    await supabase.from('shifts').update({
      transaction_count: (shift.transaction_count ?? 0) + 1,
      gross_sales: (shift.gross_sales ?? 0) + total,
      mpesa_sales: (shift.mpesa_sales ?? 0) + total,
      net_sales: (shift.net_sales ?? 0) + total,
    }).eq('id', shiftId);
  }

  // Update customer history
  if (customerId) {
    const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
    if (customer) {
      await supabase.from('customers').update({
        total_spending: (customer.total_spending ?? 0) + total,
        last_purchase_at: new Date().toISOString(),
      }).eq('id', customerId);
    }
  }

  // Update table status
  if (tableId) {
    await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', tableId);
  }

  // Close tab
  if (tabId) {
    await supabase.from('tabs').update({ status: 'paid', total }).eq('id', tabId);
  }

  // Generate receipt
  await supabase.from('receipts').insert({
    sale_id: saleId,
    receipt_number: (await supabase.from('sales').select('receipt_number').eq('id', saleId).maybeSingle()).data?.receipt_number,
    reprint_count: 0,
    payload: { cart, total, mpesa_reference: mpesaTransaction.mpesa_receipt_number },
  });

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: cashierId,
    action: 'sale.completed',
    entity: 'sale',
    entity_id: saleId,
    new_value: { total, payment_method: 'mpesa', mpesa_reference: mpesaTransaction.mpesa_receipt_number },
  });
}

export async function markPaymentFailed(mpesaTransactionId: string, saleId: string, reason: string): Promise<void> {
  await supabase.from('mpesa_transactions').update({
    status: 'failed',
    result_desc: reason,
  }).eq('id', mpesaTransactionId);

  await supabase.from('payments').update({ status: 'failed' }).eq('sale_id', saleId);

  await supabase.from('sales').update({ payment_status: 'failed' }).eq('id', saleId);
}
