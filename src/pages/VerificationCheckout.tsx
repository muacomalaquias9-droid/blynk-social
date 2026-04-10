import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Star, Crown, Check, Copy, Clock, CheckCircle, Loader2, RefreshCw, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const plans = [
  {
    id: "basic",
    name: "Básico",
    price: 500,
    icon: Shield,
    features: ["Selo de verificação azul", "Proteção de conta básica", "Prioridade no suporte"],
    color: "from-sky-400 to-blue-600",
    bg: "bg-sky-500/5 border-sky-500/20",
  },
  {
    id: "premium",
    name: "Premium",
    price: 2000,
    icon: Star,
    popular: true,
    features: ["Selo de verificação azul", "Proteção avançada", "Monetização por visualizações", "Prioridade no feed", "Suporte prioritário"],
    color: "from-violet-500 to-purple-700",
    bg: "bg-violet-500/5 border-violet-500/20",
  },
  {
    id: "elite",
    name: "Elite",
    price: 5000,
    icon: Crown,
    features: ["Selo de verificação azul", "Proteção máxima", "Monetização completa", "Monetização por curtidas", "Destaque nos resultados", "Badge exclusiva", "100+ funções premium"],
    color: "from-amber-400 to-orange-600",
    bg: "bg-amber-500/5 border-amber-500/20",
  },
];

const REFERENCE_EXPIRY_MINUTES = 15;

export default function VerificationCheckout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [existingSub, setExistingSub] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [checkCount, setCheckCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // User profile data for payment
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");

  useEffect(() => {
    if (user) {
      checkExistingSubscription();
      loadProfile();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, first_name, email, phone")
      .eq("id", user!.id)
      .single();
    if (data) {
      setUserName(data.full_name || data.first_name || "");
      setUserEmail(data.email || user!.email || "");
      setUserPhone(data.phone || "");
    }
  };

  useEffect(() => {
    if (!paymentData?.createdAt) return;
    const expiresAt = new Date(paymentData.createdAt).getTime() + REFERENCE_EXPIRY_MINUTES * 60 * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        toast.error("Referência expirada. Gere uma nova.");
        setPaymentData(null);
        setSelectedPlan(null);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paymentData?.createdAt]);

  useEffect(() => {
    if (!paymentData?.subscriptionId && !existingSub?.id) return;
    pollRef.current = setInterval(() => {
      handleCheckPayment(true);
    }, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [paymentData?.subscriptionId, existingSub?.id]);

  const checkExistingSubscription = async () => {
    const { data } = await supabase
      .from("verification_subscriptions")
      .select("*")
      .eq("user_id", user!.id)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setExistingSub(data[0]);
      if (data[0].status === "pending") {
        setPaymentData({
          reference: data[0].payment_reference,
          entity: '01055',
          amount: data[0].amount,
          subscriptionId: data[0].id,
          createdAt: data[0].created_at,
        });
        setSelectedPlan(data[0].plan_type);
      }
    }
  };

  const handleSelectPlan = async (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan || !user) return;

    if (!userName.trim()) {
      toast.error("Por favor, preencha o seu nome");
      return;
    }

    setSelectedPlan(planId);
    setLoading(true);

    try {
      // Update profile with user data before payment
      await supabase.from("profiles").update({
        full_name: userName.trim(),
        email: userEmail.trim(),
        phone: userPhone.trim(),
      }).eq("id", user.id);

      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { plan_type: planId, amount: plan.price },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const ref = data.reference || data.subscription?.payment_reference || data.payment?.reference || data.payment?.data?.reference;
      const entity = data.entity || data.payment?.entity || data.payment?.data?.entity || '01055';

      setPaymentData({
        reference: ref,
        entity: entity,
        amount: plan.price,
        subscriptionId: data.subscription?.id,
        createdAt: new Date().toISOString(),
      });

      toast.success("Referência gerada com sucesso!");
    } catch (err: any) {
      console.error("Payment error:", err);
      toast.error(err.message || "Erro ao gerar pagamento");
      setSelectedPlan(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleCheckPayment = async (silent = false) => {
    if (!existingSub && !paymentData?.subscriptionId) return;
    if (!silent) setChecking(true);

    try {
      const subId = existingSub?.id || paymentData.subscriptionId;
      const { data, error } = await supabase.functions.invoke("check-payment", {
        body: { subscription_id: subId },
      });

      if (error) throw error;
      setCheckCount(prev => prev + 1);

      if (data.status === "paid") {
        if (pollRef.current) clearInterval(pollRef.current);
        toast.success("Pagamento confirmado! Selo ativado!");
        navigate("/profile");
      } else if (!silent) {
        toast.info("Pagamento ainda pendente. Monitorando automaticamente...");
      }
    } catch (err: any) {
      if (!silent) toast.error("Erro ao verificar pagamento");
    } finally {
      if (!silent) setChecking(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (existingSub?.status === "paid") {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="app-header">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Verificação</h1>
          </div>
        </div>
        <div className="p-6 flex flex-col items-center gap-4 mt-12">
          <div className="p-5 rounded-full bg-green-500/10 animate-pulse">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold">Conta Verificada!</h2>
          <p className="text-muted-foreground text-center">O seu selo de verificação está ativo.</p>
          <Button onClick={() => navigate("/profile")} className="mt-4">Ver Perfil</Button>
        </div>
      </div>
    );
  }

  if (paymentData) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="app-header">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={() => { setPaymentData(null); setSelectedPlan(null); }} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Confirmar Pagamento</h1>
          </div>
        </div>

        <div className="p-4 max-w-md mx-auto space-y-5">
          {/* Monitoring Status */}
          <Card className="p-5 border-2 border-orange-400/40 bg-gradient-to-br from-orange-500/5 to-amber-500/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-orange-500 animate-pulse" />
                <span className="font-bold text-orange-500">Aguardando Pagamento</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
                <span>Auto-check</span>
              </div>
            </div>

            {/* Entity / Reference / Value */}
            <div className="space-y-3">
              {[
                { label: "Entidade", value: paymentData.entity || '01055' },
                { label: "Referência", value: paymentData.reference || "Gerando..." },
                { label: "Valor", value: `${paymentData.amount} AOA`, highlight: true },
              ].map((item) => (
                <div key={item.label} className="bg-background rounded-xl p-4 flex items-center justify-between border">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">{item.label}</p>
                    <p className={`text-xl font-bold mt-0.5 ${item.highlight ? 'text-orange-500' : ''}`}>{item.value}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-orange-500/10" onClick={() => handleCopy(item.highlight ? `${paymentData.amount}` : (item.value), item.label)}>
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Notice */}
            <div className="mt-4 bg-orange-500/10 rounded-xl p-3 text-center border border-orange-500/20">
              <p className="text-sm text-muted-foreground">
                Efetue o pagamento no <span className="font-semibold text-foreground">Multicaixa Express</span>, banco ou ATM com os dados acima.
              </p>
            </div>
          </Card>

          {/* Timer */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="text-muted-foreground">Expira em</span>
            <span className={`font-mono font-bold text-lg ${timeLeft < 120 ? 'text-red-500' : 'text-orange-500'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Check Button */}
          <Button
            onClick={() => handleCheckPayment(false)}
            disabled={checking}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
          >
            {checking ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <RefreshCw className="h-5 w-5 mr-2" />}
            Verificar Pagamento
          </Button>

          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            🔒 Pagamentos seguros via PlinqPay
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="app-header">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Selo de Verificação</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Hero */}
        <div className="text-center space-y-3 py-4">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Verificação Oficial
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">Escolha o seu plano</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">Obtém o selo verificado e desbloqueia funcionalidades premium do Blynk</p>
        </div>

        {/* User Data Section */}
        <Card className="p-4 space-y-3 border-dashed">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Dados para pagamento
          </p>
          <Input placeholder="Nome completo *" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <Input placeholder="Email" type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
          <Input placeholder="Telefone" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} />
        </Card>

        {/* Plans */}
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`p-5 cursor-pointer transition-all duration-300 relative overflow-hidden border-2 hover:shadow-xl active:scale-[0.98] ${plan.bg} ${
                selectedPlan === plan.id ? "ring-2 ring-primary shadow-lg" : ""
              }`}
              onClick={() => !loading && handleSelectPlan(plan.id)}
            >
              {plan.popular && (
                <Badge className="absolute top-3 right-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 shadow-md">
                  ⭐ Popular
                </Badge>
              )}

              <div className="flex items-start gap-4">
                <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${plan.color} text-white shadow-lg`}>
                  <plan.icon className="h-7 w-7" />
                </div>

                <div className="flex-1">
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  <p className="text-3xl font-extrabold mt-1 tracking-tight">
                    {plan.price.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">kz/mês</span>
                  </p>

                  <ul className="mt-3 space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`mt-4 w-full font-semibold bg-gradient-to-r ${plan.color} text-white border-0 shadow-md hover:shadow-lg`}
                    disabled={loading}
                    onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan.id); }}
                  >
                    {loading && selectedPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Pagar {plan.price.toLocaleString()} kz
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center pb-4">
          Pagamento por referência Multicaixa Express (Entidade 01055). O selo é ativado automaticamente após confirmação.
        </p>
      </div>
    </div>
  );
}
