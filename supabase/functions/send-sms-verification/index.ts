import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSmsRequest {
  phoneNumber: string;
  action: 'send' | 'verify';
  code?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, action, code }: SendSmsRequest = await req.json();

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const serviceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');

    if (!accountSid || !authToken || !serviceSid) {
      throw new Error('Twilio credentials not configured');
    }

    const twilioAuth = btoa(`${accountSid}:${authToken}`);

    if (action === 'send') {
      // Send verification code via Twilio Verify
      const response = await fetch(
        `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phoneNumber,
            Channel: 'sms',
          }).toString(),
        }
      );

      const result = await response.json();
      console.log('Twilio send result:', JSON.stringify(result));

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send SMS');
      }

      return new Response(
        JSON.stringify({ success: true, status: result.status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'verify') {
      // Verify the code via Twilio Verify
      if (!code) throw new Error('Code is required for verification');

      const response = await fetch(
        `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phoneNumber,
            Code: code,
          }).toString(),
        }
      );

      const result = await response.json();
      console.log('Twilio verify result:', JSON.stringify(result));

      if (!response.ok) {
        throw new Error(result.message || 'Verification failed');
      }

      return new Response(
        JSON.stringify({ 
          success: result.status === 'approved', 
          status: result.status,
          valid: result.valid 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-sms-verification:', message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
