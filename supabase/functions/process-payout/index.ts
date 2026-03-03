import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PLIQPAY_SECRET_KEY = Deno.env.get('PLIQPAY_SECRET_KEY');
    const PLIQPAY_PUBLIC_KEY = Deno.env.get('PLIQPAY_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) throw new Error('Not authorized - admin only');

    const { withdrawal_id, action } = await req.json();

    if (!withdrawal_id) throw new Error('withdrawal_id required');
    if (!['approve', 'reject'].includes(action)) throw new Error('Invalid action');

    // Get withdrawal
    const { data: withdrawal, error: wErr } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', withdrawal_id)
      .single();

    if (wErr || !withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'pending') throw new Error('Withdrawal already processed');

    if (action === 'reject') {
      await supabase.from('withdrawal_requests').update({
        status: 'rejected',
        payout_status: 'rejected',
        processed_by: user.id,
        processed_at: new Date().toISOString(),
      }).eq('id', withdrawal_id);

      return new Response(JSON.stringify({ success: true, status: 'rejected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try PlinqPay payout via multiple endpoints
    let payoutSuccess = false;
    let payoutReference = `MANUAL_${Date.now()}`;
    let errorMsg = null;

    if (PLIQPAY_SECRET_KEY && PLIQPAY_PUBLIC_KEY) {
      // Try transfer endpoint
      const endpoints = [
        'https://api.plinqpay.com/v1/transfer',
        'https://api.plinqpay.com/v1/payout',
        'https://api.plinqpay.com/v1/disbursement',
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`Trying payout endpoint: ${endpoint}`);
          
          const payoutBody = {
            amount: withdrawal.amount,
            currency: 'AOA',
            recipient: {
              iban: withdrawal.iban,
              name: withdrawal.account_name,
              phone: withdrawal.phone || '',
              bank_code: withdrawal.iban?.substring(4, 8) || '',
            },
            description: `Blynk Payout - ${withdrawal.id}`,
            reference: `PAYOUT_${withdrawal.id}_${Date.now()}`,
            callback_url: `${supabaseUrl}/functions/v1/payment-webhook`,
          };

          const payoutResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': PLIQPAY_SECRET_KEY,
              'Authorization': `Bearer ${PLIQPAY_SECRET_KEY}`,
              'X-API-Key': PLIQPAY_PUBLIC_KEY,
            },
            body: JSON.stringify(payoutBody),
          });

          const responseText = await payoutResponse.text();
          console.log(`PlinqPay ${endpoint} response:`, payoutResponse.status, responseText);

          if (payoutResponse.ok) {
            try {
              const payoutData = JSON.parse(responseText);
              payoutReference = payoutData.reference || payoutData.id || payoutData.transaction_id || payoutReference;
              payoutSuccess = true;
              errorMsg = null;
              console.log('Payout successful via', endpoint);
              break;
            } catch {
              payoutSuccess = true;
              errorMsg = null;
              break;
            }
          } else if (payoutResponse.status === 404) {
            // Endpoint not available, try next
            errorMsg = `${endpoint}: 404 - Not available`;
            continue;
          } else {
            errorMsg = `${endpoint}: ${payoutResponse.status} - ${responseText.substring(0, 200)}`;
          }
      } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          errorMsg = `${endpoint}: Connection error - ${errMsg}`;
          console.error(`Payout error at ${endpoint}:`, errMsg);
        }
      }

      // If all transfer endpoints failed, try creating a payment request to the user's account
      if (!payoutSuccess) {
        try {
          console.log('Attempting payment creation as fallback...');
          const paymentResponse = await fetch('https://api.plinqpay.com/v1/payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': PLIQPAY_PUBLIC_KEY,
            },
            body: JSON.stringify({
              amount: withdrawal.amount,
              entity: '01055',
              description: `Blynk Saque - ${withdrawal.account_name}`,
              reference: `SAQUE_${withdrawal.id}`,
              callback_url: `${supabaseUrl}/functions/v1/payment-webhook`,
            }),
          });

          const paymentText = await paymentResponse.text();
          console.log('Payment fallback response:', paymentResponse.status, paymentText);
          
          if (paymentResponse.ok) {
            try {
              const paymentData = JSON.parse(paymentText);
              payoutReference = paymentData.reference || paymentData.id || `PAYMENT_${Date.now()}`;
            } catch {}
          }
        } catch (e: unknown) {
          console.error('Payment fallback error:', e instanceof Error ? e.message : e);
        }
      }
    } else {
      errorMsg = 'PlinqPay API keys not configured';
    }

    // Update withdrawal status
    const updateData: any = {
      status: 'approved',
      payout_status: payoutSuccess ? 'completed' : 'manual_transfer',
      payout_reference: payoutReference,
      processed_by: user.id,
      processed_at: new Date().toISOString(),
    };
    if (errorMsg) updateData.error_message = errorMsg;

    await supabase.from('withdrawal_requests').update(updateData).eq('id', withdrawal_id);

    // Log the payout
    await supabase.from('admin_payment_logs').insert({
      user_id: withdrawal.user_id,
      amount: -withdrawal.amount,
      payment_reference: payoutReference,
      status: 'withdrawn',
      subscription_id: null,
    });

    // Notify user
    await supabase.from('notifications').insert({
      user_id: withdrawal.user_id,
      type: 'payment',
      title: 'Saque processado',
      message: payoutSuccess
        ? `O teu saque de ${withdrawal.amount} kz foi processado automaticamente via PlinqPay.`
        : `O teu saque de ${withdrawal.amount} kz foi aprovado e será transferido manualmente para ${withdrawal.iban}.`,
      related_id: withdrawal_id,
    });

    return new Response(JSON.stringify({
      success: true,
      status: 'approved',
      payout_method: payoutSuccess ? 'automatic' : 'manual_transfer',
      payout_reference: payoutReference,
      iban: withdrawal.iban,
      account_name: withdrawal.account_name,
      amount: withdrawal.amount,
      error_details: errorMsg,
      message: payoutSuccess
        ? 'Payout processado automaticamente via PlinqPay'
        : `Transfira manualmente ${withdrawal.amount} kz para IBAN ${withdrawal.iban} (${withdrawal.account_name})`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Process payout error:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
