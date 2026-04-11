import { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { 
  Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock, User, AtSign, Phone, MessageSquare
} from 'lucide-react';
import InputOTP from '@/components/auth/AuthOTPInput';
import onboarding1 from '@/assets/onboarding-1.png';
import onboarding2 from '@/assets/onboarding-2.png';
import onboarding3 from '@/assets/onboarding-3.png';
import communityAvatars from '@/assets/community-avatars.png';

type AuthStep = 
  | 'welcome' | 'login' 
  | 'signup-name' | 'signup-username' | 'signup-credential' | 'signup-password' 
  | 'verify-email' | 'verify-phone' 
  | 'forgot-password';

type CredentialType = 'email' | 'phone';

const onboardingSlides = [
  { image: onboarding1, title: 'Conecta-te', subtitle: 'Encontra amigos e faz novas conexões' },
  { image: onboarding2, title: 'Partilha', subtitle: 'Publica momentos e histórias' },
  { image: onboarding3, title: 'Descobre', subtitle: 'Explora conteúdo feito para ti' },
];

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
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [formData, setFormData] = useState({
    firstName: '', email: '', phone: '', username: '', password: '',
  });

  useEffect(() => {
    if (location.state?.mode === 'signup') setStep('signup-name');
  }, [location]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-slide carousel
  useEffect(() => {
    if (step === 'welcome') {
      slideInterval.current = setInterval(() => {
        setCurrentSlide(p => (p + 1) % 3);
      }, 3500);
      return () => { if (slideInterval.current) clearInterval(slideInterval.current); };
    }
  }, [step]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold text-primary">blynk</h1>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </motion.div>
      </div>
    );
  }

  if (user) return <Navigate to="/feed" replace />;

  const updateFormData = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));
  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhone = (v: string) => /^\+[1-9]\d{7,14}$/.test(v);

  const handleLogin = async () => {
    const loginCredential = loginMode === 'email' ? formData.email : formData.phone;
    if (!loginCredential || !formData.password) { toast.error('Preencha todos os campos'); return; }
    setIsLoading(true);
    try {
      if (loginMode === 'phone') {
        const { data: profile } = await supabase.from('profiles').select('email').eq('phone', formData.phone).single();
        if (!profile?.email) throw new Error('Número não encontrado.');
        const { error } = await supabase.auth.signInWithPassword({ email: profile.email, password: formData.password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
        if (error) throw error;
      }
      toast.success('Login realizado!');
    } catch (error: any) {
      if (error.message?.includes('Email not confirmed')) {
        toast.error('Confirma o teu email primeiro');
        setStep('verify-email');
      } else {
        toast.error(error.message || 'Erro ao fazer login');
      }
    } finally { setIsLoading(false); }
  };

  const sendPhoneVerification = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-verification', { body: { phoneNumber: formData.phone, action: 'send' } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar SMS');
      toast.success('Código SMS enviado!');
      setResendCooldown(60);
    } catch (error: any) { toast.error(error.message || 'Erro ao enviar SMS'); }
    finally { setIsLoading(false); }
  };

  const verifyPhoneCode = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-verification', { body: { phoneNumber: formData.phone, action: 'verify', code: verificationCode } });
      if (error) throw error;
      return data?.success === true;
    } catch { return false; }
  };

  const handleSignup = async () => {
    if (!formData.firstName || !formData.username || !formData.password) { toast.error('Preencha todos os campos'); return; }
    if (credentialType === 'email' && !formData.email) { toast.error('Insere o teu email'); return; }
    if (credentialType === 'phone' && !formData.phone) { toast.error('Insere o teu número'); return; }
    if (formData.password.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    setIsLoading(true);
    try {
      if (credentialType === 'phone') {
        await sendPhoneVerification();
        setStep('verify-phone');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email, password: formData.password,
          options: { emailRedirectTo: `${window.location.origin}/`, data: { first_name: formData.firstName, username: formData.username } }
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').upsert({ id: data.user.id, first_name: formData.firstName, username: formData.username, email: formData.email });
        }
        toast.success('Conta criada! Verifica o teu email.');
        setStep('verify-email');
      }
    } catch (error: any) { toast.error(error.message || 'Erro ao criar conta'); }
    finally { setIsLoading(false); }
  };

  const handleVerifyPhone = async () => {
    if (verificationCode.length < 6) { toast.error('Insere o código completo'); return; }
    setIsLoading(true);
    try {
      const verified = await verifyPhoneCode();
      if (!verified) { toast.error('Código inválido'); return; }
      const tempEmail = `${formData.phone.replace(/\+/g, '')}@phone.blynk.app`;
      const { data, error } = await supabase.auth.signUp({
        email: tempEmail, password: formData.password,
        options: { emailRedirectTo: `${window.location.origin}/`, data: { first_name: formData.firstName, username: formData.username, phone: formData.phone, phone_verified: true } }
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').upsert({ id: data.user.id, first_name: formData.firstName, username: formData.username, phone: formData.phone, email: tempEmail });
      }
      toast.success('Conta criada!');
    } catch (error: any) { toast.error(error.message || 'Erro'); }
    finally { setIsLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) { toast.error('Digite seu email'); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      toast.success('Email de recuperação enviado!');
      setStep('login');
    } catch (error: any) { toast.error(error.message || 'Erro'); }
    finally { setIsLoading(false); }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: formData.email });
      if (error) throw error;
      toast.success('Email reenviado!');
    } catch (error: any) { toast.error(error.message || 'Erro'); }
    finally { setIsLoading(false); }
  };

  const handleVerifyOTP = async () => {
    if (verificationCode.length < 6) { toast.error('Insere o código completo'); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: formData.email, token: verificationCode, type: 'signup' });
      if (error) throw error;
      toast.success('Email verificado!');
    } catch (error: any) { toast.error(error.message || 'Código inválido'); }
    finally { setIsLoading(false); }
  };

  const goBack = () => {
    const backMap: Record<AuthStep, AuthStep> = {
      'welcome': 'welcome', 'login': 'welcome', 'signup-name': 'welcome',
      'signup-username': 'signup-name', 'signup-credential': 'signup-username',
      'signup-password': 'signup-credential', 'verify-email': 'login',
      'verify-phone': 'signup-credential', 'forgot-password': 'login',
    };
    setStep(backMap[step]);
  };

  const slideVariants = {
    enter: { x: 60, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -60, opacity: 0 },
  };

  const inputClass = "h-14 rounded-2xl text-base bg-muted/30 border border-border/50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/30 transition-all";

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto">
      {step !== 'welcome' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sticky top-0 z-10 p-4">
          <Button variant="ghost" size="icon" onClick={goBack} className="rounded-full h-10 w-10 bg-muted/50 backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </motion.div>
      )}

      <div className="flex-1 flex flex-col justify-center px-6 pb-8 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* ══════ Welcome ══════ */}
          {step === 'welcome' && (
            <motion.div key="welcome" variants={slideVariants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="flex flex-col items-center text-center gap-6">
              
              {/* Carousel */}
              <div className="relative w-full h-56 flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div key={currentSlide}
                    initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                  >
                    <img src={onboardingSlides[currentSlide].image} alt="" className="h-36 w-auto object-contain" />
                    <h3 className="text-lg font-bold">{onboardingSlides[currentSlide].title}</h3>
                    <p className="text-sm text-muted-foreground">{onboardingSlides[currentSlide].subtitle}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Dots */}
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <button key={i} onClick={() => setCurrentSlide(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'}`} />
                ))}
              </div>

              {/* Community avatars */}
              <div className="flex flex-col items-center gap-2">
                <img src={communityAvatars} alt="Comunidade" className="h-12 w-auto object-contain" />
                <p className="text-xs text-muted-foreground">Junta-te a milhares de pessoas</p>
              </div>

              <div className="w-full space-y-3">
                <Button onClick={() => setStep('login')}
                  className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                  Iniciar sessão
                </Button>
                <Button onClick={() => setStep('signup-name')} variant="outline"
                  className="w-full h-14 rounded-2xl text-base font-semibold border-2 border-border/80">
                  Criar nova conta
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground/60">© 2026/2027 Blynk</p>
            </motion.div>
          )}

          {/* ══════ Login ══════ */}
          {step === 'login' && (
            <motion.div key="login" variants={slideVariants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Bem-vindo de volta</h2>
                <p className="text-muted-foreground">Inicia sessão na tua conta</p>
              </div>

              <div className="flex gap-1 p-1 bg-muted/30 rounded-2xl border border-border/30">
                <button onClick={() => setLoginMode('email')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${loginMode === 'email' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button onClick={() => setLoginMode('phone')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${loginMode === 'phone' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                  <Phone className="h-4 w-4" /> Telefone
                </button>
              </div>

              <div className="space-y-4">
                {loginMode === 'email' ? (
                  <Input type="email" placeholder="nome@email.com" value={formData.email}
                    onChange={(e) => updateFormData('email', e.target.value)} className={inputClass} />
                ) : (
                  <Input type="tel" placeholder="+244 9XX XXX XXX" value={formData.phone}
                    onChange={(e) => updateFormData('phone', e.target.value)} className={inputClass} />
                )}
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={formData.password}
                    onChange={(e) => updateFormData('password', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className={`${inputClass} pr-12`} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full">
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button variant="link" onClick={() => setStep('forgot-password')} className="text-primary text-sm h-auto p-0">
                    Esqueceste a palavra-passe?
                  </Button>
                </div>
                <Button onClick={handleLogin} disabled={isLoading}
                  className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Entrar'}
                </Button>
              </div>
              <div className="text-center pt-2">
                <span className="text-muted-foreground text-sm">Não tens conta? </span>
                <Button variant="link" onClick={() => setStep('signup-name')} className="text-primary font-semibold h-auto p-0 text-sm">Criar conta</Button>
              </div>
            </motion.div>
          )}

          {/* ══════ Signup Steps ══════ */}
          {step === 'signup-name' && (
            <motion.div key="signup-name" variants={slideVariants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="space-y-6">
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"><User className="h-6 w-6 text-primary" /></div>
                <h2 className="text-3xl font-bold">Como te chamas?</h2>
                <p className="text-muted-foreground">Este será o teu nome visível.</p>
              </div>
              <Input placeholder="O teu nome" value={formData.firstName} onChange={(e) => updateFormData('firstName', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && formData.firstName && setStep('signup-username')} autoFocus className={inputClass} />
              <Button onClick={() => setStep('signup-username')} disabled={!formData.firstName.trim()}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">Continuar</Button>
              <div className="text-center">
                <span className="text-muted-foreground text-sm">Já tens conta? </span>
                <Button variant="link" onClick={() => setStep('login')} className="text-primary font-semibold h-auto p-0 text-sm">Iniciar sessão</Button>
              </div>
            </motion.div>
          )}

          {step === 'signup-username' && (
            <motion.div key="signup-username" variants={slideVariants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="space-y-6">
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"><AtSign className="h-6 w-6 text-primary" /></div>
                <h2 className="text-3xl font-bold">Escolhe um username</h2>
                <p className="text-muted-foreground">Letras, números e underscores.</p>
              </div>
              <Input placeholder="nome_de_utilizador" value={formData.username}
                onChange={(e) => updateFormData('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && formData.username.length >= 3 && setStep('signup-credential')}
                autoFocus className={inputClass} />
              <Button onClick={() => setStep('signup-credential')} disabled={!formData.username.trim() || formData.username.length < 3}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">Continuar</Button>
            </motion.div>
          )}

          {step === 'signup-credential' && (
            <motion.div key="signup-credential" variants={slideVariants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="space-y-6">
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  {credentialType === 'email' ? <Mail className="h-6 w-6 text-primary" /> : <Phone className="h-6 w-6 text-primary" />}
                </div>
                <h2 className="text-3xl font-bold">{credentialType === 'email' ? 'Qual é o teu email?' : 'Qual é o teu número?'}</h2>
              </div>
              <div className="flex gap-1 p-1 bg-muted/30 rounded-2xl border border-border/30">
                <button onClick={() => setCredentialType('email')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${credentialType === 'email' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button onClick={() => setCredentialType('phone')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${credentialType === 'phone' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                  <Phone className="h-4 w-4" /> Telefone
                </button>
              </div>
              {credentialType === 'email' ? (
                <Input type="email" placeholder="nome@email.com" value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)} autoFocus className={inputClass} />
              ) : (
                <Input type="tel" placeholder="+244 9XX XXX XXX" value={formData.phone}
                  onChange={(e) => updateFormData('phone', e.target.value)} autoFocus className={inputClass} />
              )}
              <Button onClick={() => setStep('signup-password')}
                disabled={credentialType === 'email' ? !isEmail(formData.email) : !isPhone(formData.phone)}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">Continuar</Button>
            </motion.div>
          )}

          {step === 'signup-password' && (
            <motion.div key="signup-password" variants={slideVariants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="space-y-6">
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"><Lock className="h-6 w-6 text-primary" /></div>
                <h2 className="text-3xl font-bold">Cria uma palavra-passe</h2>
                <p className="text-muted-foreground">Mínimo de 6 caracteres.</p>
              </div>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && formData.password.length >= 6 && handleSignup()}
                  autoFocus className={`${inputClass} pr-12`} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full">
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                    formData.password.length >= i * 2 ? formData.password.length >= 8 ? 'bg-green-500' : 'bg-yellow-500' : 'bg-muted'
                  }`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground/60 px-1">Ao registares-te, concordas com os nossos Termos e Política de Privacidade.</p>
              <Button onClick={handleSignup} disabled={isLoading || formData.password.length < 6}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Criar conta'}
              </Button>
            </motion.div>
          )}

          {/* ══════ Verify Email ══════ */}
          {step === 'verify-email' && (
            <motion.div key="verify-email" variants={slideVariants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="space-y-6 text-center">
              <div className="space-y-3">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Mail className="h-10 w-10 text-primary" />
                </motion.div>
                <h2 className="text-3xl font-bold">Verifica o teu email</h2>
                <p className="text-muted-foreground">Enviámos um código para <span className="font-semibold text-foreground">{formData.email}</span></p>
              </div>
              <div className="flex justify-center py-4"><InputOTP value={verificationCode} onChange={setVerificationCode} length={6} /></div>
              <Button onClick={handleVerifyOTP} disabled={isLoading || verificationCode.length < 6}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verificar'}
              </Button>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Não recebeste?</p>
                <Button variant="link" onClick={handleResendVerification} disabled={isLoading} className="text-primary font-semibold h-auto p-0">Reenviar</Button>
              </div>
              <Button variant="ghost" onClick={() => setStep('login')} className="text-muted-foreground text-sm">Voltar ao login</Button>
            </motion.div>
          )}

          {/* ══════ Verify Phone ══════ */}
          {step === 'verify-phone' && (
            <motion.div key="verify-phone" variants={slideVariants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="space-y-6 text-center">
              <div className="space-y-3">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                  <MessageSquare className="h-10 w-10 text-primary" />
                </motion.div>
                <h2 className="text-3xl font-bold">Verifica o teu número</h2>
                <p className="text-muted-foreground">SMS enviado para <span className="font-semibold text-foreground">{formData.phone}</span></p>
              </div>
              <div className="flex justify-center py-4"><InputOTP value={verificationCode} onChange={setVerificationCode} length={6} /></div>
              <Button onClick={handleVerifyPhone} disabled={isLoading || verificationCode.length < 6}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verificar e criar conta'}
              </Button>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Não recebeste?</p>
                <Button variant="link" onClick={sendPhoneVerification} disabled={isLoading || resendCooldown > 0}
                  className="text-primary font-semibold h-auto p-0">
                  {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar SMS'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ══════ Forgot Password ══════ */}
          {step === 'forgot-password' && (
            <motion.div key="forgot-password" variants={slideVariants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="space-y-6">
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"><Lock className="h-6 w-6 text-primary" /></div>
                <h2 className="text-3xl font-bold">Recuperar conta</h2>
                <p className="text-muted-foreground">Envia o email associado à tua conta.</p>
              </div>
              <Input type="email" placeholder="nome@email.com" value={formData.email}
                onChange={(e) => updateFormData('email', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()} autoFocus className={inputClass} />
              <Button onClick={handleForgotPassword} disabled={isLoading || !formData.email}
                className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar email'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
