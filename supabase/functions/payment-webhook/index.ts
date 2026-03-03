import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function verifyHmacSignature(payload: any, signature: string, secretKey: string): Promise<boolean> {
  try {
    const payloadToVerify = {
      externalId: payload.externId || payload.externalId,
      amount: payload.amount,
      method: payload.method,
      callbackUrl: payload.callbackUrl,
    };

    const canonical = JSON.stringify(payloadToVerify);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
    const expectedSignature = base64Encode(sig);

    return expectedSignature === signature;
  } catch (e) {
    console.error('HMAC verification error:', e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Chave SECRETA para validar e aprovar pagamentos
    const PLIQPAY_SECRET_KEY = Deno.env.get('PLIQPAY_SECRET_KEY');
    if (!PLIQPAY_SECRET_KEY) {
      console.error('PLIQPAY_SECRET_KEY not configured');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body));

    // Validate HMAC signature if present
    const signature = body.signature || body.sign;
    if (signature) {
      const isValid = await verifyHmacSignature(body, signature, PLIQPAY_SECRET_KEY);
      if (!isValid) {
        console.error('Invalid HMAC signature - rejecting webhook');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('HMAC signature verified successfully');
    } else {
      console.log('No signature in payload, proceeding with status check');
    }

    const externId = body.externId || body.externalId;
    const status = body.status;
    const reference = body.reference;
    const transactionId = body.id;

    if (!externId) {
      return new Response(JSON.stringify({ error: 'Missing externId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subscription, error: findError } = await supabase
      .from('verification_subscriptions')
      .select('*')
      .eq('external_id', externId)
      .single();

    if (findError || !subscription) {
      console.error('Subscription not found for:', externId);
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isPaid = status === 'SUCCESS' || status === 'PAID' || status === 'COMPLETED';
    const isFailed = status === 'FAILED' || status === 'CANCELLED';

    if (isPaid) {
      await supabase
        .from('verification_subscriptions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_reference: reference || subscription.payment_reference,
          transaction_id: transactionId || subscription.transaction_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      await supabase
        .from('profiles')
        .update({ verified: true, badge_type: 'blue' })
        .eq('id', subscription.user_id);

      await supabase
        .from('admin_payment_logs')
        .insert({
          subscription_id: subscription.id,
          user_id: subscription.user_id,
          amount: subscription.amount,
          payment_reference: reference || subscription.payment_reference,
          status: 'received',
        });

      await supabase
        .from('notifications')
        .insert({
          user_id: subscription.user_id,
          type: 'verification',
          title: 'Selo Verificado!',
          message: 'O seu pagamento foi confirmado. O selo de verificação foi ativado na sua conta!',
        });

      console.log('Payment approved via SECRET key for user:', subscription.user_id);
    } else if (isFailed) {
      await supabase
        .from('verification_subscriptions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      console.log('Payment failed for user:', subscription.user_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
