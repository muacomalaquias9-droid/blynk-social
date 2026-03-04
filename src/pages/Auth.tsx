import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { 
  Eye, 
  EyeOff, 
  ArrowLeft,
  Loader2,
  Mail,
  Lock,
  User,
  AtSign,
  ShieldCheck,
  Sparkles,
  Phone,
  MessageSquare
} from 'lucide-react';
import InputOTP from '@/components/auth/AuthOTPInput';

type AuthStep = 
  | 'welcome' | 'login' 
  | 'signup-name' | 'signup-username' | 'signup-credential' | 'signup-password' 
  | 'verify-email' | 'verify-phone' 
  | 'forgot-password';

type CredentialType = 'email' | 'phone';

export default function Auth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [step, setStep] = useState<AuthStep>('welcome');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [credentialType, setCredentialType] = useState<CredentialType>('email');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loginMode, setLoginMode] = useState<CredentialType>('email');
  
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
  });

  useEffect(() => {
    if (location.state?.mode === 'signup') {
      setStep('signup-name');
    }
  }, [location]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <h1 className="text-4xl font-bold text-primary">blynk</h1>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </motion.div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/feed" replace />;
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhone = (v: string) => /^\+[1-9]\d{7,14}$/.test(v);
  const credential = credentialType === 'email' ? formData.email : formData.phone;

  // ── Login ──
  const handleLogin = async () => {
    const loginCredential = loginMode === 'email' ? formData.email : formData.phone;
    if (!loginCredential || !formData.password) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    try {
      if (loginMode === 'phone') {
        // For phone login, we use email lookup by phone
        // First find the email associated with this phone
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('phone', formData.phone)
          .single();

        if (!profile?.email) {
          throw new Error('Número não encontrado. Cria uma conta primeiro.');
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password: formData.password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
      }
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      if (error.message?.includes('Email not confirmed')) {
        toast.error('Confirma o teu email antes de iniciar sessão');
        setStep('verify-email');
      } else {
        toast.error(error.message || 'Erro ao fazer login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Send Phone Verification (Twilio) ──
  const sendPhoneVerification = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-verification', {
        body: { phoneNumber: formData.phone, action: 'send' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar SMS');
      
      toast.success('Código SMS enviado!');
      setResendCooldown(60);
    } catch (error: any) {
      console.error('SMS error:', error);
      toast.error(error.message || 'Erro ao enviar SMS');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Verify Phone Code (Twilio) ──
  const verifyPhoneCode = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-verification', {
        body: { phoneNumber: formData.phone, action: 'verify', code: verificationCode },
      });
      if (error) throw error;
      return data?.success === true;
    } catch (error: any) {
      console.error('Verify error:', error);
      return false;
    }
  };

  // ── Signup ──
  const handleSignup = async () => {
    if (!formData.firstName || !formData.username || !formData.password) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (credentialType === 'email' && !formData.email) {
      toast.error('Insere o teu email');
      return;
    }
    if (credentialType === 'phone' && !formData.phone) {
      toast.error('Insere o teu número de telefone');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('A palavra-passe deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      if (credentialType === 'phone') {
        // Send SMS verification first, then create account after verification
        await sendPhoneVerification();
        setStep('verify-phone');
      } else {
        // Email signup
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              first_name: formData.firstName,
              username: formData.username,
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            first_name: formData.firstName,
            username: formData.username,
            email: formData.email,
          });
        }

        toast.success('Conta criada! Verifica o teu email.');
        setStep('verify-email');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Verify Phone & Create Account ──
  const handleVerifyPhone = async () => {
    if (verificationCode.length < 6) {
      toast.error('Insere o código completo');
      return;
    }

    setIsLoading(true);
    try {
      const verified = await verifyPhoneCode();
      if (!verified) {
        toast.error('Código inválido ou expirado');
        return;
      }

      // Phone verified! Create account with a generated email
      const tempEmail = `${formData.phone.replace(/\+/g, '')}@phone.blynk.app`;
      
      const { data, error } = await supabase.auth.signUp({
        email: tempEmail,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: formData.firstName,
            username: formData.username,
            phone: formData.phone,
            phone_verified: true,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          first_name: formData.firstName,
          username: formData.username,
          phone: formData.phone,
          email: tempEmail,
        });
      }

      toast.success('Número verificado e conta criada!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      toast.error('Digite seu email');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Email de recuperação enviado!');
      setStep('login');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: formData.email,
      });
      if (error) throw error;
      toast.success('Email reenviado!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao reenviar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (verificationCode.length < 6) {
      toast.error('Insere o código completo');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: verificationCode,
        type: 'signup',
      });
      if (error) throw error;
      toast.success('Email verificado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Código inválido');
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    const backMap: Record<AuthStep, AuthStep> = {
      'welcome': 'welcome',
      'login': 'welcome',
      'signup-name': 'welcome',
      'signup-username': 'signup-name',
      'signup-credential': 'signup-username',
      'signup-password': 'signup-credential',
      'verify-email': 'login',
      'verify-phone': 'signup-credential',
      'forgot-password': 'login',
    };
    setStep(backMap[step]);
  };

  const slideVariants = {
    enter: { x: 60, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -60, opacity: 0 },
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto">
      {step !== 'welcome' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="sticky top-0 z-10 p-4"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="rounded-full h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </motion.div>
      )}

      <div className="flex-1 flex flex-col justify-center px-6 pb-8 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* ══════ Welcome ══════ */}
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              className="flex flex-col items-center text-center gap-8"
            >
              <div className="space-y-3">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
                >
                  <h1 className="text-6xl font-extrabold tracking-tight text-primary">blynk</h1>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-muted-foreground text-lg leading-relaxed"
                >
                  Conecta-te com amigos e o mundo à tua volta.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="w-full space-y-3"
              >
                <Button
                  onClick={() => setStep('login')}
                  className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90"
                >
                  Iniciar sessão
                </Button>
                <Button
                  onClick={() => setStep('signup-name')}
                  variant="outline"
                  className="w-full h-14 rounded-2xl text-base font-semibold border-2"
                >
                  Criar nova conta
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xs text-muted-foreground"
              >
                © 2026/2027 Blynk
              </motion.p>
            </motion.div>
          )}

          {/* ══════ Login ══════ */}
          {step === 'login' && (
            <motion.div
              key="login"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Bem-vindo de volta</h2>
                <p className="text-muted-foreground">Inicia sessão na tua conta</p>
              </div>

              {/* Login mode toggle */}
              <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
                <button
                  onClick={() => setLoginMode('email')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    loginMode === 'email' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button
                  onClick={() => setLoginMode('phone')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    loginMode === 'phone' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <Phone className="h-4 w-4" /> Telefone
                </button>
              </div>

              <div className="space-y-4">
                {loginMode === 'email' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </label>
                    <Input
                      type="email"
                      placeholder="nome@email.com"
                      value={formData.email}
                      onChange={(e) => updateFormData('email', e.target.value)}
                      className="h-14 rounded-xl text-base bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Número de telefone
                    </label>
                    <Input
                      type="tel"
                      placeholder="+244 9XX XXX XXX"
                      value={formData.phone}
                      onChange={(e) => updateFormData('phone', e.target.value)}
                      className="h-14 rounded-xl text-base bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Palavra-passe
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => updateFormData('password', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      className="h-14 rounded-xl text-base pr-12 bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="link"
                    onClick={() => setStep('forgot-password')}
                    className="text-primary text-sm font-medium h-auto p-0"
                  >
                    Esqueceste a palavra-passe?
                  </Button>
                </div>

                <Button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Entrar'}
                </Button>
              </div>

              <div className="text-center pt-4">
                <span className="text-muted-foreground text-sm">Não tens conta? </span>
                <Button
                  variant="link"
                  onClick={() => setStep('signup-name')}
                  className="text-primary font-semibold h-auto p-0 text-sm"
                >
                  Criar conta
                </Button>
              </div>
            </motion.div>
          )}

          {/* ══════ Signup Step 1: Name ══════ */}
          {step === 'signup-name' && (
            <motion.div
              key="signup-name"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-3xl font-bold">Como te chamas?</h2>
                <p className="text-muted-foreground">Este será o teu nome visível na plataforma.</p>
              </div>

              <Input
                placeholder="O teu nome"
                value={formData.firstName}
                onChange={(e) => updateFormData('firstName', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && formData.firstName && setStep('signup-username')}
                autoFocus
                className="h-14 rounded-xl text-base bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
              />

              <Button
                onClick={() => setStep('signup-username')}
                disabled={!formData.firstName.trim()}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90"
              >
                Continuar
              </Button>

              <div className="text-center">
                <span className="text-muted-foreground text-sm">Já tens conta? </span>
                <Button
                  variant="link"
                  onClick={() => setStep('login')}
                  className="text-primary font-semibold h-auto p-0 text-sm"
                >
                  Iniciar sessão
                </Button>
              </div>
            </motion.div>
          )}

          {/* ══════ Signup Step 2: Username ══════ */}
          {step === 'signup-username' && (
            <motion.div
              key="signup-username"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <AtSign className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-3xl font-bold">Escolhe um username</h2>
                <p className="text-muted-foreground">Usa letras, números e underscores.</p>
              </div>

              <Input
                placeholder="nome_de_utilizador"
                value={formData.username}
                onChange={(e) => updateFormData('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && formData.username.length >= 3 && setStep('signup-credential')}
                autoFocus
                className="h-14 rounded-xl text-base bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
              />

              <Button
                onClick={() => setStep('signup-credential')}
                disabled={!formData.username.trim() || formData.username.length < 3}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90"
              >
                Continuar
              </Button>
            </motion.div>
          )}

          {/* ══════ Signup Step 3: Email or Phone ══════ */}
          {step === 'signup-credential' && (
            <motion.div
              key="signup-credential"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  {credentialType === 'email' ? <Mail className="h-6 w-6 text-primary" /> : <Phone className="h-6 w-6 text-primary" />}
                </div>
                <h2 className="text-3xl font-bold">
                  {credentialType === 'email' ? 'Qual é o teu email?' : 'Qual é o teu número?'}
                </h2>
                <p className="text-muted-foreground">
                  {credentialType === 'email' 
                    ? 'Vamos enviar-te um código de verificação por email.' 
                    : 'Vamos enviar-te um código SMS via Twilio.'}
                </p>
              </div>

              {/* Toggle email / phone */}
              <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
                <button
                  onClick={() => setCredentialType('email')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    credentialType === 'email' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button
                  onClick={() => setCredentialType('phone')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    credentialType === 'phone' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <Phone className="h-4 w-4" /> Telefone
                </button>
              </div>

              {credentialType === 'email' ? (
                <Input
                  type="email"
                  placeholder="nome@email.com"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && isEmail(formData.email) && setStep('signup-password')}
                  autoFocus
                  className="h-14 rounded-xl text-base bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                />
              ) : (
                <Input
                  type="tel"
                  placeholder="+244 9XX XXX XXX"
                  value={formData.phone}
                  onChange={(e) => updateFormData('phone', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && isPhone(formData.phone) && setStep('signup-password')}
                  autoFocus
                  className="h-14 rounded-xl text-base bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                />
              )}

              <Button
                onClick={() => setStep('signup-password')}
                disabled={credentialType === 'email' ? !isEmail(formData.email) : !isPhone(formData.phone)}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90"
              >
                Continuar
              </Button>
            </motion.div>
          )}

          {/* ══════ Signup Step 4: Password ══════ */}
          {step === 'signup-password' && (
            <motion.div
              key="signup-password"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-3xl font-bold">Cria uma palavra-passe</h2>
                <p className="text-muted-foreground">Mínimo de 6 caracteres.</p>
              </div>

              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && formData.password.length >= 6 && handleSignup()}
                  autoFocus
                  className="h-14 rounded-xl text-base pr-12 bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full"
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>

              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      formData.password.length >= i * 2
                        ? formData.password.length >= 8
                          ? 'bg-green-500'
                          : 'bg-yellow-500'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              <p className="text-xs text-muted-foreground px-1">
                Ao registares-te, concordas com os nossos Termos de Serviço e Política de Privacidade.
              </p>

              <Button
                onClick={handleSignup}
                disabled={isLoading || formData.password.length < 6}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Criar conta'}
              </Button>
            </motion.div>
          )}

          {/* ══════ Email Verification ══════ */}
          {step === 'verify-email' && (
            <motion.div
              key="verify-email"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              className="space-y-6 text-center"
            >
              <div className="space-y-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto"
                >
                  <Mail className="h-10 w-10 text-primary" />
                </motion.div>
                <h2 className="text-3xl font-bold">Verifica o teu email</h2>
                <p className="text-muted-foreground">
                  Enviámos um código para{' '}
                  <span className="font-semibold text-foreground">{formData.email}</span>
                </p>
              </div>

              <div className="flex justify-center py-4">
                <InputOTP value={verificationCode} onChange={setVerificationCode} length={6} />
              </div>

              <Button
                onClick={handleVerifyOTP}
                disabled={isLoading || verificationCode.length < 6}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verificar'}
              </Button>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Não recebeste o código?</p>
                <Button
                  variant="link"
                  onClick={handleResendVerification}
                  disabled={isLoading}
                  className="text-primary font-semibold h-auto p-0"
                >
                  Reenviar código
                </Button>
              </div>

              <Button variant="ghost" onClick={() => setStep('login')} className="text-muted-foreground text-sm">
                Voltar ao login
              </Button>
            </motion.div>
          )}

          {/* ══════ Phone Verification (Twilio) ══════ */}
          {step === 'verify-phone' && (
            <motion.div
              key="verify-phone"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              className="space-y-6 text-center"
            >
              <div className="space-y-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto"
                >
                  <MessageSquare className="h-10 w-10 text-primary" />
                </motion.div>
                <h2 className="text-3xl font-bold">Verifica o teu número</h2>
                <p className="text-muted-foreground">
                  Enviámos um SMS para{' '}
                  <span className="font-semibold text-foreground">{formData.phone}</span>
                </p>
              </div>

              <div className="flex justify-center py-4">
                <InputOTP value={verificationCode} onChange={setVerificationCode} length={6} />
              </div>

              <Button
                onClick={handleVerifyPhone}
                disabled={isLoading || verificationCode.length < 6}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verificar e criar conta'}
              </Button>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Não recebeste o SMS?</p>
                <Button
                  variant="link"
                  onClick={sendPhoneVerification}
                  disabled={isLoading || resendCooldown > 0}
                  className="text-primary font-semibold h-auto p-0"
                >
                  {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar SMS'}
                </Button>
              </div>

              <Button variant="ghost" onClick={() => setStep('signup-credential')} className="text-muted-foreground text-sm">
                Alterar número
              </Button>
            </motion.div>
          )}

          {/* ══════ Forgot Password ══════ */}
          {step === 'forgot-password' && (
            <motion.div
              key="forgot-password"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-3xl font-bold">Recuperar conta</h2>
                <p className="text-muted-foreground">Introduz o teu email e vamos enviar-te um link de recuperação.</p>
              </div>

              <Input
                type="email"
                placeholder="nome@email.com"
                value={formData.email}
                onChange={(e) => updateFormData('email', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && formData.email && handleForgotPassword()}
                autoFocus
                className="h-14 rounded-xl text-base bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
              />

              <Button
                onClick={handleForgotPassword}
                disabled={isLoading || !formData.email}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar link'}
              </Button>

              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => setStep('login')}
                  className="text-primary font-semibold h-auto p-0 text-sm"
                >
                  Voltar ao login
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
