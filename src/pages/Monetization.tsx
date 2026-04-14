import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Eye, Heart, DollarSign, Wallet, Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Monetization() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<any[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [withdrawnTotal, setWithdrawnTotal] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [iban, setIban] = useState("");
  const [accountName, setAccountName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const [earningsRes, profileRes, withdrawRes] = await Promise.all([
      supabase.from("user_earnings").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("verified, full_name, phone").eq("id", user!.id).single(),
      supabase.from("withdrawal_requests").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    ]);

    const earningsData = earningsRes.data || [];
    setEarnings(earningsData);
    setTotalEarnings(earningsData.reduce((sum, e) => sum + e.amount, 0));
    setIsVerified(profileRes.data?.verified || false);
    
    if (profileRes.data?.full_name) setAccountName(profileRes.data.full_name);
    if (profileRes.data?.phone) setPhone(profileRes.data.phone);

    const withdrawData = withdrawRes.data || [];
    setWithdrawals(withdrawData);
    // Only count withdrawals where the actual bank transfer was confirmed (payout_status = 'completed')
    const completedWithdrawals = withdrawData.filter((w: any) => w.payout_status === 'completed');
    const approved = completedWithdrawals.reduce((sum: number, w: any) => sum + w.amount, 0);
    setWithdrawnTotal(approved);
  };

  const availableBalance = totalEarnings - withdrawnTotal;

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 200) {
      toast.error("Valor mínimo de saque: 200 kz");
      return;
    }
    if (amount > availableBalance) {
      toast.error("Saldo insuficiente");
      return;
    }
    if (!iban.trim() || !accountName.trim()) {
      toast.error("Preencha IBAN e nome do titular");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("withdrawal_requests").insert({
        user_id: user!.id,
        amount,
        iban: iban.trim(),
        account_name: accountName.trim(),
        phone: phone.trim(),
      });

      if (error) throw error;
      toast.success("Pedido de saque enviado! Será processado por IBAN instantâneo.");
      setWithdrawAmount("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao solicitar saque");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (w: any) => {
    if (w.payout_status === 'completed') {
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Transferido</Badge>;
    }
    if (w.status === 'approved' && w.payout_status === 'manual_transfer') {
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Aguardando transferência</Badge>;
    }
    switch (w.status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge>{w.status}</Badge>;
    }
  };

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="app-header">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Monetização</h1>
          </div>
        </div>
        <div className="p-6 text-center space-y-4 mt-12">
          <DollarSign className="h-16 w-16 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-bold">Conta não verificada</h2>
          <p className="text-muted-foreground">Precisas ter o selo de verificação para monetizar o teu conteúdo.</p>
          <Button onClick={() => navigate("/verification-checkout")}>Obter Selo de Verificação</Button>
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
          <h1 className="text-lg font-bold">Monetização</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Balance Card */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Saldo Disponível</p>
            <p className="text-4xl font-bold mt-1">{availableBalance.toLocaleString()} <span className="text-lg">kz</span></p>
            <p className="text-xs text-muted-foreground mt-1">Total ganho: {totalEarnings.toLocaleString()} kz · Sacado: {withdrawnTotal.toLocaleString()} kz</p>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <Eye className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className="text-sm font-bold">{earnings.filter(e => e.source_type === "views").length}</p>
            <p className="text-xs text-muted-foreground">Visualizações</p>
          </Card>
          <Card className="p-3 text-center">
            <Heart className="h-5 w-5 mx-auto text-red-500 mb-1" />
            <p className="text-sm font-bold">{earnings.filter(e => e.source_type === "likes").length}</p>
            <p className="text-xs text-muted-foreground">Curtidas</p>
          </Card>
          <Card className="p-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-sm font-bold">{earnings.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </Card>
        </div>

        {/* Withdraw */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Solicitar Saque (IBAN Instantâneo)</h3>
          </div>
          <p className="text-xs text-muted-foreground">Mínimo: 200 kz · Processamento instantâneo por IBAN</p>

          <Input placeholder="Valor (kz)" type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
          <Input placeholder="IBAN *" value={iban} onChange={(e) => setIban(e.target.value)} />
          <Input placeholder="Nome do titular *" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          <Input placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />

          <Button onClick={handleWithdraw} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Solicitar Saque
          </Button>
        </Card>

        {/* Withdrawal History */}
        {withdrawals.length > 0 && (
          <>
            <h3 className="font-semibold">Histórico de Saques</h3>
            {withdrawals.map((w) => (
              <Card key={w.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{w.amount} kz → {w.iban}</p>
                  <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                {getStatusBadge(w.status)}
              </Card>
            ))}
          </>
        )}

        {/* Earnings History */}
        <h3 className="font-semibold">Histórico de Ganhos</h3>
        {earnings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum ganho registrado ainda</p>
        ) : (
          earnings.slice(0, 20).map((e) => (
            <Card key={e.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{e.description || e.source_type}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <p className="font-bold text-green-500">+{e.amount} kz</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function Send(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
  );
}
