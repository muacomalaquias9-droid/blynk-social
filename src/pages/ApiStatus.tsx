import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface LogRow {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  ip_address: string | null;
  origin: string | null;
  created_at: string;
}

interface RouteMetric {
  endpoint: string;
  total: number;
  errors: number;
  avg: number;
  p95: number;
  max: number;
}

const PUBLIC_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export default function ApiStatus() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [metrics, setMetrics] = useState<RouteMetric[]>([]);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [healthLatency, setHealthLatency] = useState<number | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    init();
    const t = setInterval(loadAll, 15000);
    return () => clearInterval(t);
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) {
      toast.error("Apenas administradores");
      navigate("/sidebar");
      return;
    }
    setIsAdmin(true);
    await loadAll();
    setLoading(false);
  };

  const loadAll = async () => {
    setRefreshing(true);
    await Promise.all([loadLogs(), runHealthCheck()]);
    setRefreshing(false);
  };

  const loadLogs = async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("api_request_logs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    const rows = (data || []) as LogRow[];
    setLogs(rows);

    // Group by endpoint
    const groups = new Map<string, LogRow[]>();
    for (const r of rows) {
      const key = r.endpoint.replace(/\/[0-9a-f-]{36}/gi, "/:id");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const m: RouteMetric[] = [];
    groups.forEach((v, key) => {
      const times = v.map((r) => r.response_time_ms || 0).filter((x) => x > 0);
      const errors = v.filter((r) => (r.status_code || 0) >= 400 || r.error_message).length;
      m.push({
        endpoint: key,
        total: v.length,
        errors,
        avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
        p95: Math.round(percentile(times, 95)),
        max: times.length ? Math.max(...times) : 0,
      });
    });
    m.sort((a, b) => b.total - a.total);
    setMetrics(m);
  };

  const runHealthCheck = async () => {
    try {
      const t0 = performance.now();
      const res = await fetch(`${PUBLIC_API_URL}/v1/stats`, {
        method: "GET",
        headers: { "X-API-Key": "health-probe" }, // intentionally invalid → expects 401
      });
      const ms = Math.round(performance.now() - t0);
      setHealthLatency(ms);
      // Endpoint is healthy if it responds (any status). Network failure = unhealthy.
      setHealthy(res.status === 401 || res.status === 200 || res.status === 404);
      setHealthError(null);
    } catch (e: any) {
      setHealthy(false);
      setHealthError(e.message || "Network error");
      setHealthLatency(null);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">A carregar…</div>;
  if (!isAdmin) return null;

  const failures = logs.filter((l) => (l.status_code || 0) >= 400 || l.error_message).slice(0, 20);
  const totalReq = logs.length;
  const totalErr = logs.filter((l) => (l.status_code || 0) >= 400 || l.error_message).length;
  const errorRate = totalReq ? ((totalErr / totalReq) * 100).toFixed(1) : "0.0";
  const overallAvg = (() => {
    const t = logs.map((l) => l.response_time_ms || 0).filter((x) => x > 0);
    return t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) : 0;
  })();

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sidebar")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2"><Activity className="h-4 w-4" /> API Status</h1>
            <p className="text-xs text-muted-foreground">Saúde, latência e falhas das últimas 24h</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-5">
        {/* Health card */}
        <Card className={`p-5 border-2 ${
          healthy === null ? "" :
          healthy ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
        }`}>
          <div className="flex items-center gap-4">
            {healthy === null ? (
              <Clock className="h-10 w-10 text-muted-foreground animate-pulse" />
            ) : healthy ? (
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            ) : (
              <AlertTriangle className="h-10 w-10 text-destructive" />
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold">
                {healthy === null ? "A verificar…" : healthy ? "Operacional" : "Indisponível"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {healthy
                  ? `Endpoint público a responder em ${healthLatency} ms`
                  : healthError || "Endpoint não respondeu"}
              </p>
              <p className="text-[11px] text-muted-foreground/60 font-mono mt-1 break-all">{PUBLIC_API_URL}</p>
            </div>
          </div>
        </Card>

        {/* Top stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pedidos 24h</p>
            <p className="text-2xl font-bold mt-1">{totalReq}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Erros</p>
            <p className="text-2xl font-bold mt-1 flex items-center gap-2">
              {totalErr}
              <span className={`text-sm font-normal ${parseFloat(errorRate) > 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {errorRate}%
              </span>
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Latência média</p>
            <p className="text-2xl font-bold mt-1 flex items-center gap-1">
              <Zap className="h-4 w-4 text-amber-500" />
              {overallAvg} ms
            </p>
          </Card>
        </div>

        {/* Per-route metrics */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Métricas por rota
          </h3>
          {metrics.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Sem pedidos nas últimas 24h.
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3 font-medium">Endpoint</th>
                      <th className="text-right p-3 font-medium">Total</th>
                      <th className="text-right p-3 font-medium">Erros</th>
                      <th className="text-right p-3 font-medium">Média</th>
                      <th className="text-right p-3 font-medium">P95</th>
                      <th className="text-right p-3 font-medium">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m) => (
                      <tr key={m.endpoint} className="border-t border-border">
                        <td className="p-3 font-mono break-all">{m.endpoint}</td>
                        <td className="p-3 text-right">{m.total}</td>
                        <td className={`p-3 text-right ${m.errors > 0 ? 'text-destructive font-medium' : ''}`}>{m.errors}</td>
                        <td className="p-3 text-right">{m.avg} ms</td>
                        <td className="p-3 text-right">{m.p95} ms</td>
                        <td className="p-3 text-right">{m.max} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Recent failures */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Últimas falhas
          </h3>
          {failures.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Sem falhas registadas nas últimas 24h.
            </Card>
          ) : (
            <Card className="divide-y divide-border">
              {failures.map((f) => (
                <div key={f.id} className="p-3 flex items-start gap-3 text-xs">
                  <Badge variant="destructive" className="font-mono text-[10px] shrink-0">
                    {f.status_code || "ERR"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <code className="font-mono break-all">{f.method} {f.endpoint}</code>
                    {f.error_message && (
                      <p className="text-destructive mt-0.5 break-words">{f.error_message}</p>
                    )}
                    <p className="text-muted-foreground mt-0.5">
                      {new Date(f.created_at).toLocaleString()}
                      {f.response_time_ms ? ` · ${f.response_time_ms} ms` : ""}
                      {f.origin ? ` · ${f.origin}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}