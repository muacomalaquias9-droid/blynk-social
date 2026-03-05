import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ArrowLeft, ArrowRight, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PhoneVerificationProps {
  phoneNumber: string;
  onVerified: () => void;
  onBack: () => void;
}

export const PhoneVerification = ({ phoneNumber, onVerified, onBack }: PhoneVerificationProps) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    sendVerificationCode();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const sendVerificationCode = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('send-sms-verification', {
        body: { phoneNumber, action: 'send' },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Falha ao enviar SMS');

      toast.success('Código enviado via SMS');
      setResendCooldown(60);
    } catch (error: any) {
      console.error('Error sending verification code:', error);
      toast.error('Erro ao enviar código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Digite o código de 6 dígitos');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('send-sms-verification', {
        body: { phoneNumber, action: 'verify', code },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Número verificado com sucesso!');
        onVerified();
      } else {
        toast.error('Código inválido ou expirado');
      }
    } catch (error: any) {
      console.error('Error verifying code:', error);
      toast.error('Erro ao verificar código');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="space-y-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4"
          disabled={loading}
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Voltar
        </Button>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Verificar Número</h2>
            <p className="text-sm text-muted-foreground">Enviamos um código para {phoneNumber}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <label className="text-sm font-medium text-foreground block text-center">
            Digite o código de 6 dígitos
          </label>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={loading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>

        <Button
          onClick={handleVerify}
          className="w-full h-14 text-lg rounded-2xl"
          disabled={code.length !== 6 || loading}
        >
          {loading ? 'Verificando...' : 'Verificar'}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={sendVerificationCode}
            disabled={resendCooldown > 0 || loading}
            className="text-sm"
          >
            {resendCooldown > 0
              ? `Reenviar em ${resendCooldown}s`
              : 'Reenviar código'}
          </Button>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            O código expira em 5 minutos. Se não receber, verifique se o número está correto.
          </p>
        </div>
      </div>
    </div>
  );
};
