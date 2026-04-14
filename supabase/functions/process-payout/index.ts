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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');
    const token = authHeader.replace('Bearer ', '');
    
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error('Invalid token');
    
    const userId = claimsData.claims.sub;

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
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
        processed_by: userId,
        processed_at: new Date().toISOString(),
      }).eq('id', withdrawal_id);

      return new Response(JSON.stringify({ success: true, status: 'rejected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Approve - mark as manual_transfer (admin will confirm after bank transfer)
    const payoutReference = `MANUAL_${Date.now()}`;

    await supabase.from('withdrawal_requests').update({
      status: 'approved',
      payout_status: 'manual_transfer',
      payout_reference: payoutReference,
      processed_by: userId,
      processed_at: new Date().toISOString(),
    }).eq('id', withdrawal_id);

    // Log
    await supabase.from('admin_payment_logs').insert({
      user_id: withdrawal.user_id,
      amount: -withdrawal.amount,
      payment_reference: payoutReference,
      status: 'withdrawn',
    });

    // Notify user
    await supabase.from('notifications').insert({
      user_id: withdrawal.user_id,
      type: 'payment',
      title: 'Saque aprovado',
      message: `O teu saque de ${withdrawal.amount} kz foi aprovado. A transferência para ${withdrawal.iban} será realizada em breve.`,
      related_id: withdrawal_id,
    });

    return new Response(JSON.stringify({
      success: true,
      status: 'approved',
      payout_method: 'manual_transfer',
      payout_reference: payoutReference,
      iban: withdrawal.iban,
      account_name: withdrawal.account_name,
      amount: withdrawal.amount,
      message: `Transfira manualmente ${withdrawal.amount} kz para IBAN ${withdrawal.iban} (${withdrawal.account_name}). Depois confirme a transferência no painel.`,
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
