import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, DollarSign, CheckCircle, Clock, XCircle, Wallet, Users, Send, Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  amount: number;
  status: string;
  payment_reference: string;
  external_id: string;
  transaction_id: string;
  paid_at: string | null;
  created_at: string;
}

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  iban: string;
  account_name: string;
  phone: string;
  status: string;
  created_at: string;
  payout_status?: string;
  payout_reference?: string;
  bank_name?: string;
  error_message?: string;
}

export default function AdminVerification() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"subscriptions" | "payments" | "withdrawals">("subscriptions");
  const [totalReceived, setTotalReceived] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Admin withdrawal
  const [withdrawIban, setWithdrawIban] = useState("AO06042000000000076790387");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, subsRes, withdrawRes] = await Promise.all([
        supabase.from("admin_payment_logs").select("*").order("created_at", { ascending: false }),
        supabase.from("verification_subscriptions").select("*").order("created_at", { ascending: false }),
        supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      ]);

      const paymentData = paymentsRes.data || [];
      const subsData = subsRes.data || [];
      const withdrawData = withdrawRes.data || [];
      setPayments(paymentData);
      setSubscriptions(subsData);
      setWithdrawals(withdrawData);

      const total = paymentData.filter(p => p.status === "received").reduce((sum: number, p: any) => sum + p.amount, 0);
      setTotalReceived(total);

      const userIds = [...new Set([
        ...paymentData.map((p: any) => p.user_id),
        ...subsData.map((s: any) => s.user_id),
        ...withdrawData.map((w: any) => w.user_id),
      ])];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, full_name, username, avatar_url, email")
          .in("id", userIds);

        const profileMap: Record<string, any> = {};
        (profilesData || []).forEach(p => { profileMap[p.id] = p; });
        setProfiles(profileMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Admin manually approves a pending subscription
  const handleApprovePayment = async (sub: Subscription) => {
    setProcessingId(sub.id);
    try {
      // 1. Mark subscription as paid
      const { error: subError } = await supabase
        .from("verification_subscriptions")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      if (subError) throw subError;

      // 2. Verify the user's profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ verified: true, badge_type: "blue" })
        .eq("id", sub.user_id);

      if (profileError) throw profileError;

      // 3. Log the payment
      const { error: logError } = await supabase
        .from("admin_payment_logs")
        .insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          amount: sub.amount,
          payment_reference: sub.payment_reference || "MANUAL",
          status: "received",
        });

      if (logError) throw logError;

      toast.success("Pagamento aprovado! Selo ativado para o usuário.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao aprovar pagamento");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectPayment = async (sub: Subscription) => {
    setProcessingId(sub.id);
    try {
      const { error } = await supabase
        .from("verification_subscriptions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      if (error) throw error;
      toast.success("Pagamento rejeitado.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setProcessingId(null);
    }
  };

  const handleProcessWithdrawal = async (id: string, action: "approve" | "reject") => {
    setProcessingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("process-payout", {
        body: { withdrawal_id: id, action },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

      if (action === "approve") {
        if (data.payout_method === "automatic") {
          toast.success(`✅ Payout automático! Ref: ${data.payout_reference}`);
        } else {
          toast.success(`📋 Aprovado! Transfira ${data.amount} kz para IBAN ${data.iban} (${data.account_name})`, { duration: 10000 });
        }
      } else {
        toast.success("Saque rejeitado");
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar saque");
    } finally {
      setProcessingId(null);
    }
  };

  const handleAdminWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (amount > totalReceived) {
      toast.error("Saldo insuficiente");
      return;
    }
    if (!withdrawIban.trim()) {
      toast.error("Informe o IBAN");
      return;
    }

    setWithdrawing(true);
    try {
      // Create a withdrawal request for admin and immediately process it
      const { data: wr, error: insertErr } = await supabase.from("withdrawal_requests").insert({
        user_id: user!.id,
        amount,
        iban: withdrawIban.trim(),
        account_name: "ISAAC CUNHA PINTO",
        phone: "943443400",
        bank_name: withdrawBank || null,
      }).select().single();

      if (insertErr) throw insertErr;

      // Process via edge function
      const { data, error } = await supabase.functions.invoke("process-payout", {
        body: { withdrawal_id: wr.id, action: "approve" },
      });

      if (error) throw error;
      toast.success(`Saque de ${amount} kz processado! Ref: ${data?.payout_reference || "N/A"}`);
      setWithdrawAmount("");
      setWithdrawBank("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar saque");
    } finally {
      setWithdrawing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
      case "received":
      case "approved":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/30">✓ {status === "approved" ? "Aprovado" : "Pago"}</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">⏳ Pendente</Badge>;
      case "withdrawn":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30">💸 Sacado</Badge>;
      case "rejected":
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/30">✗ {status === "failed" ? "Falhado" : "Rejeitado"}</Badge>;
      default:
        return <Badge variant="destructive">{status}</Badge>;
    }
  };

  const pendingSubscriptions = subscriptions.filter(s => s.status === "pending");
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending");

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="app-header">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Pagamentos & Saques</h1>
          <Button variant="ghost" size="icon" onClick={loadData} className="ml-auto rounded-full">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
          <p className="text-lg font-bold">{totalReceived.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Recebido (kz)</p>
        </Card>
        <Card className="p-3 text-center">
          <Users className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-lg font-bold">{subscriptions.filter(s => s.status === "paid").length}</p>
          <p className="text-[10px] text-muted-foreground">Verificados</p>
        </Card>
        <Card className="p-3 text-center">
          <Clock className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
          <p className="text-lg font-bold">{pendingSubscriptions.length}</p>
          <p className="text-[10px] text-muted-foreground">Pend. Aprovação</p>
        </Card>
      </div>

      {/* Admin Withdraw Card */}
      <Card className="mx-4 p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Sacar Fundos</h3>
        </div>
        <Input placeholder="IBAN destino" value={withdrawIban} onChange={(e) => setWithdrawIban(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Valor (kz)" type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
          <Input placeholder="Banco (opcional)" value={withdrawBank} onChange={(e) => setWithdrawBank(e.target.value)} />
        </div>
        <Button onClick={handleAdminWithdraw} disabled={withdrawing} className="w-full">
          {withdrawing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Realizar Saque Instantâneo
        </Button>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-border mt-4">
        {([
          { key: "subscriptions" as const, label: "Assinaturas", badge: pendingSubscriptions.length },
          { key: "payments" as const, label: "Pagamentos", badge: 0 },
          { key: "withdrawals" as const, label: "Saques", badge: pendingWithdrawals.length },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
              tab === t.key ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="absolute top-2 right-4 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                {t.badge}
              </span>
            )}
            {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : tab === "subscriptions" ? (
          subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma assinatura</div>
          ) : (
            subscriptions.map((s) => {
              const profile = profiles[s.user_id];
              return (
                <Card key={s.id} className={`p-4 ${s.status === "pending" ? "border-yellow-500/30 bg-yellow-500/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{profile?.full_name || profile?.first_name || "Usuário"}</p>
                      <p className="text-sm text-muted-foreground">@{profile?.username} · {s.plan_type}</p>
                      <p className="text-xs text-muted-foreground">Ref: {s.payment_reference || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{s.amount} kz</p>
                      {getStatusBadge(s.status)}
                    </div>
                  </div>

                  {/* Admin actions for pending payments */}
                  {s.status === "pending" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                        disabled={processingId === s.id}
                        onClick={() => handleApprovePayment(s)}
                      >
                        {processingId === s.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                        Aprovar & Verificar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        disabled={processingId === s.id}
                        onClick={() => handleRejectPayment(s)}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })
          )
        ) : tab === "payments" ? (
          payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum pagamento registrado. Aprove assinaturas pendentes para ver aqui.</div>
          ) : (
            payments.map((p) => {
              const profile = profiles[p.user_id];
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{profile?.full_name || profile?.first_name || "Usuário"}</p>
                      <p className="text-sm text-muted-foreground">@{profile?.username}</p>
                      <p className="text-xs text-muted-foreground">Ref: {p.payment_reference}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${p.amount < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {p.amount < 0 ? '' : '+'}{p.amount} kz
                      </p>
                      {getStatusBadge(p.status)}
                    </div>
                  </div>
                </Card>
              );
            })
          )
        ) : (
          withdrawals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum pedido de saque</div>
          ) : (
            withdrawals.map((w) => {
              const profile = profiles[w.user_id];
              return (
                <Card key={w.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold">{profile?.full_name || profile?.first_name || "Usuário"}</p>
                      <p className="text-sm text-muted-foreground">@{profile?.username}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{w.amount} kz</p>
                      {getStatusBadge(w.status)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2 mt-2">
                    <p>IBAN: <span className="font-mono text-foreground">{w.iban}</span></p>
                    <p>Titular: {w.account_name}</p>
                    {w.phone && <p>Tel: {w.phone}</p>}
                    <p>{new Date(w.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  {w.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                        disabled={processingId === w.id}
                        onClick={() => handleProcessWithdrawal(w.id, "approve")}
                      >
                        {processingId === w.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "✅ Aprovar & Transferir"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        disabled={processingId === w.id}
                        onClick={() => handleProcessWithdrawal(w.id, "reject")}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  )}
                  {w.payout_status === "manual_transfer" && (
                    <div className="mt-2 p-2 bg-yellow-500/10 rounded text-xs space-y-2">
                      <p className="font-semibold text-yellow-600">⚠️ Transferência manual necessária:</p>
                      <p>IBAN: <span className="font-mono">{w.iban}</span></p>
                      <p>Titular: {w.account_name} · Valor: {w.amount} kz</p>
                      {w.payout_reference && <p>Ref: {w.payout_reference}</p>}
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                        disabled={processingId === w.id}
                        onClick={async () => {
                          setProcessingId(w.id);
                          try {
                            const { error } = await supabase.from("withdrawal_requests").update({
                              payout_status: "completed",
                            }).eq("id", w.id);
                            if (error) throw error;
                            await supabase.from("notifications").insert({
                              user_id: w.user_id,
                              type: "payment",
                              title: "Saque transferido!",
                              message: `O teu saque de ${w.amount} kz foi transferido para ${w.iban}.`,
                              related_id: w.id,
                            });
                            toast.success(`✅ Transferência de ${w.amount} kz confirmada!`);
                            loadData();
                          } catch (err: any) {
                            toast.error(err.message || "Erro");
                          } finally {
                            setProcessingId(null);
                          }
                        }}
                      >
                        {processingId === w.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        ✅ Confirmar Transferência Realizada
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
