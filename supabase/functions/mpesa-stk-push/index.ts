import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface StkRequestBody {
  mpesa_transaction_id: string;
  phone: string;
  amount: number;
  sale_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as StkRequestBody;
    const { mpesa_transaction_id, phone, amount, sale_id } = body;

    if (!mpesa_transaction_id || !phone || !amount || !sale_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: mpesa_transaction_id, phone, amount, sale_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Read M-Pesa Daraja credentials from edge function secrets (never from frontend)
    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
    const passkey = Deno.env.get('MPESA_PASSKEY');
    const shortcode = Deno.env.get('MPESA_SHORTCODE');
    const environment = Deno.env.get('MPESA_ENVIRONMENT') ?? 'sandbox';

    // If credentials are not configured, return a clear configuration state
    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
      // Mark transaction as pending — system is not configured for live M-Pesa
      const supabase = createSupabaseClient();
      await supabase
        .from('mpesa_transactions')
        .update({
          status: 'pending',
          result_desc: 'M-Pesa not configured. Admin must set Daraja credentials in M-Pesa settings.',
        })
        .eq('id', mpesa_transaction_id);

      return new Response(
        JSON.stringify({
          error: 'M-Pesa is not configured. An administrator must set the Daraja credentials in the M-Pesa settings page.',
          not_configured: true,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 1: Get OAuth access token from Daraja
    const authUrl = environment === 'production'
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    const authResponse = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${consumerKey}:${consumerSecret}`),
      },
    });

    if (!authResponse.ok) {
      const errText = await authResponse.text();
      return new Response(
        JSON.stringify({ error: `Daraja auth failed: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Step 2: Build STK Push request
    const timestamp = getTimestamp();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const stkUrl = environment === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/mpesa-callback`,
      AccountReference: sale_id.slice(0, 12),
      TransactionDesc: 'Cafeteria POS payment',
    };

    const stkResponse = await fetch(stkUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPayload),
    });

    const stkData = await stkResponse.json();

    if (!stkResponse.ok || stkData.ResponseCode !== '0') {
      // STK request rejected
      const supabase = createSupabaseClient();
      await supabase
        .from('mpesa_transactions')
        .update({
          status: 'failed',
          result_code: stkData.ResponseCode ? parseInt(stkData.ResponseCode) : null,
          result_desc: stkData.ResponseDescription || stkData.errorMessage || 'STK Push rejected',
        })
        .eq('id', mpesa_transaction_id);

      return new Response(
        JSON.stringify({
          error: stkData.ResponseDescription || stkData.errorMessage || 'STK Push was rejected',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // STK successfully initiated — store checkout/merchant IDs for idempotency
    const checkoutRequestId = stkData.CheckoutRequestID;
    const merchantRequestId = stkData.MerchantRequestID;

    const supabase = createSupabaseClient();
    await supabase
      .from('mpesa_transactions')
      .update({
        status: 'pending',
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
      })
      .eq('id', mpesa_transaction_id);

    return new Response(
      JSON.stringify({
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
        customer_message: `STK Push sent to 0${phone.slice(3)}. Ask the customer to enter their M-Pesa PIN.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Payment could not be initiated: ${message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function getTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}${h}${min}${s}`;
}

function createSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
