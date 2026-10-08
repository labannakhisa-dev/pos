import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CallbackBody {
  Body?: {
    stkCallback?: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item?: Array<{ Name: string; Value: string | number }>;
      };
    };
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as CallbackBody;
    const callback = body.Body?.stkCallback;

    if (!callback) {
      return new Response(
        JSON.stringify({ error: 'Invalid callback format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
    const supabase = createSupabaseClient();

    // Find the transaction by checkout_request_id (idempotency — duplicate callbacks won't create duplicates)
    const { data: mpesaTx } = await supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('checkout_request_id', CheckoutRequestID)
      .maybeSingle();

    if (!mpesaTx) {
      // Unmatched payment — store for reconciliation
      await supabase.from('mpesa_transactions').insert({
        phone: '',
        amount: 0,
        payment_type: 'stk_push',
        status: ResultCode === 0 ? 'success' : 'failed',
        result_code: ResultCode,
        result_desc: ResultDesc,
        callback_payload: body,
        reconciliation_status: 'unmatched',
        merchant_request_id: MerchantRequestID,
        checkout_request_id: CheckoutRequestID,
      });
      return new Response(JSON.stringify({ received: true, matched: false }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Already processed? Idempotency check
    if (mpesaTx.status === 'success' || mpesaTx.status === 'failed') {
      return new Response(JSON.stringify({ received: true, already_processed: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (ResultCode === 0) {
      // Success — extract receipt number and amount
      const items = CallbackMetadata?.Item ?? [];
      const receiptNo = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value as string ?? null;
      const amount = items.find((i) => i.Name === 'Amount')?.Value as number ?? mpesaTx.amount;
      const phone = items.find((i) => i.Name === 'PhoneNumber')?.Value as string ?? mpesaTx.phone;

      // Update M-Pesa transaction
      await supabase.from('mpesa_transactions').update({
        status: 'success',
        result_code: 0,
        result_desc: ResultDesc,
        mpesa_receipt_number: receiptNo,
        callback_payload: body,
        reconciliation_status: 'matched',
      }).eq('id', mpesaTx.id);

      // Mark payment + sale as paid
      await supabase.from('payments').update({ status: 'success' }).eq('sale_id', mpesaTx.sale_id);
      await supabase.from('sales').update({ payment_status: 'paid' }).eq('id', mpesaTx.sale_id);

      // Reduce inventory
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('*, products(id, current_stock)')
        .eq('sale_id', mpesaTx.sale_id);

      for (const item of saleItems ?? []) {
        const product = item.products as { id: string; current_stock: number } | null;
        if (!product) continue;
        const prevQty = product.current_stock;
        const newQty = prevQty - item.quantity;
        await supabase.from('products').update({ current_stock: newQty }).eq('id', product.id);
        await supabase.from('inventory_movements').insert({
          product_id: product.id,
          movement_type: 'sale',
          quantity_change: -item.quantity,
          previous_quantity: prevQty,
          new_quantity: newQty,
          reason: `Sale ${receiptNo ?? mpesaTx.sale_id.slice(0, 8)}`,
          reference_type: 'sale',
          reference_id: mpesaTx.sale_id,
          user_id: mpesaTx.created_by,
        });
      }

      // Update shift totals
      const { data: sale } = await supabase.from('sales').select('shift_id, total, cashier_id, customer_id, table_id, tab_id').eq('id', mpesaTx.sale_id).maybeSingle();
      if (sale) {
        await supabase.rpc('update_shift_on_sale', { p_shift_id: sale.shift_id, p_amount: sale.total }).catch(() => {});
        if (sale.customer_id) {
          const { data: cust } = await supabase.from('customers').select('total_spending').eq('id', sale.customer_id).maybeSingle();
          if (cust) {
            await supabase.from('customers').update({
              total_spending: (cust.total_spending ?? 0) + sale.total,
              last_purchase_at: new Date().toISOString(),
            }).eq('id', sale.customer_id);
          }
        }
        if (sale.table_id) {
          await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', sale.table_id);
        }
        if (sale.tab_id) {
          await supabase.from('tabs').update({ status: 'paid', total: sale.total }).eq('id', sale.tab_id);
        }
        await supabase.from('audit_logs').insert({
          user_id: sale.cashier_id,
          action: 'sale.completed',
          entity: 'sale',
          entity_id: mpesaTx.sale_id,
          new_value: { total: sale.total, mpesa_reference: receiptNo },
        });
      }
    } else {
      // Failed
      await supabase.from('mpesa_transactions').update({
        status: 'failed',
        result_code: ResultCode,
        result_desc: ResultDesc,
        callback_payload: body,
      }).eq('id', mpesaTx.id);

      await supabase.from('payments').update({ status: 'failed' }).eq('sale_id', mpesaTx.sale_id);
      await supabase.from('sales').update({ payment_status: 'failed' }).eq('id', mpesaTx.sale_id);
    }

    return new Response(JSON.stringify({ received: true, success: ResultCode === 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function createSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
