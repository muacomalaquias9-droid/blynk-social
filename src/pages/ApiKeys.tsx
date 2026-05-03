import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Copy, Check, Trash2, Eye, EyeOff, KeyRound, Shield, Activity, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  public_key: string;
  secret_key_preview: string;
  scopes: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

const ALL_SCOPES = [
  { id: "read:posts", label: "Ler publicações" },
  { id: "read:profiles", label: "Ler perfis" },
  { id: "read:users", label: "Ler utilizadores" },
  { id: "read:comments", label: "Ler comentários" },
  { id: "read:likes", label: "Ler curtidas" },
  { id: "read:messages", label: "Ler mensagens (sensível)" },
  { id: "write:messages", label: "Enviar mensagens" },
  { id: "read:music", label: "Ler músicas" },
  { id: "write:music", label: "Criar músicas" },
  { id: "read:stories", label: "Ler stories" },
  { id: "write:stories", label: "Criar stories" },
  { id: "payments:reference", label: "Pagamentos referência" },
  { id: "auth:login", label: "Login externo" },
  { id: "auth:signup", label: "Cadastro externo" },
];

function randomKey(prefix: string, len = 40) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  return `${prefix}_${s}`;
}

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ApiKeys() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read:posts", "read:profiles", "read:users", "read:music", "read:stories", "write:messages", "payments:reference"]);
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<{ pub: string; sec: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) {
      toast.error("Apenas administradores podem aceder à API");
      navigate("/sidebar");
      return;
    }
    setIsAdmin(true);
    await loadKeys();
    setLoading(false);
  };

  const loadKeys = async () => {
    const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
    setKeys(data || []);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Dá um nome à API"); return; }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const publicKey = randomKey("pk_live", 32);
    const secretKey = randomKey("sk_live", 48);
    const hash = await sha256Hex(secretKey);
    const preview = `${secretKey.slice(0, 12)}…${secretKey.slice(-4)}`;

    const { error } = await supabase.from("api_keys").insert({
      user_id: user.id,
      name,
      description,
      public_key: publicKey,
      secret_key_hash: hash,
      secret_key_preview: preview,
      scopes,
    });

    if (error) { toast.error("Falha ao criar API: " + error.message); setCreating(false); return; }

    setCreatedSecret({ pub: publicKey, sec: secretKey });
    setName(""); setDescription("");
    await loadKeys();
    setCreating(false);
  };

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Copiado");
    setTimeout(() => setCopied(null), 1500);
  };

  const toggleActive = async (k: ApiKey) => {
    await supabase.from("api_keys").update({ is_active: !k.is_active }).eq("id", k.id);
    await loadKeys();
    toast.success(k.is_active ? "Desativada" : "Ativada");
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminar esta API? Sites que a usam deixarão de funcionar.")) return;
    await supabase.from("api_keys").delete().eq("id", id);
    await loadKeys();
    toast.success("API eliminada");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">A carregar…</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sidebar")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2"><KeyRound className="h-4 w-4" /> Blynk API</h1>
            <p className="text-xs text-muted-foreground">Integra a tua plataforma com qualquer site/app</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/docs")}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Docs
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Apenas Admin</h3>
              <p className="text-sm text-muted-foreground">
                Esta API dá acesso completo aos dados do Blynk (posts, perfis, mensagens, login). Mantém a chave secreta privada — nunca a publiques no front-end.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">As tuas chaves ({keys.length})</h2>
          <Button onClick={() => { setOpen(true); setCreatedSecret(null); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova API
          </Button>
        </div>

        {keys.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Ainda não tens nenhuma chave de API</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <Card key={k.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{k.name}</h3>
                      <Badge variant={k.is_active ? "default" : "secondary"}>{k.is_active ? "Ativa" : "Pausada"}</Badge>
                    </div>
                    {k.description && <p className="text-xs text-muted-foreground mt-0.5">{k.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(k)}>
                      {k.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(k.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 font-mono">
                    <span className="text-muted-foreground shrink-0">Public:</span>
                    <span className="flex-1 truncate">{k.public_key}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(k.public_key, k.id + "p")}>
                      {copied === k.id + "p" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 font-mono">
                    <span className="text-muted-foreground shrink-0">Secret:</span>
                    <span className="flex-1 truncate text-muted-foreground">{k.secret_key_preview}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {k.scopes.map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                </div>

                <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {k.rate_limit_per_minute}/min</span>
                  <span>Criada {new Date(k.created_at).toLocaleDateString()}</span>
                  {k.last_used_at && <span>Última: {new Date(k.last_used_at).toLocaleString()}</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCreatedSecret(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createdSecret ? "Chave criada" : "Nova chave de API"}</DialogTitle>
          </DialogHeader>

          {createdSecret ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive font-medium">⚠ Guarda a chave secreta agora. Não a poderás ver novamente.</p>
              <div>
                <Label className="text-xs">Public Key</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={createdSecret.pub} className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copy(createdSecret.pub, "newp")}>
                    {copied === "newp" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Secret Key</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly type={showSecret ? "text" : "password"} value={createdSecret.sec} className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => copy(createdSecret.sec, "news")}>
                    {copied === "news" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button onClick={() => { setOpen(false); setCreatedSecret(null); }} className="w-full">Fechar</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Meu site externo" />
              </div>
              <div>
                <Label htmlFor="desc">Descrição (opcional)</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Permissões</Label>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {ALL_SCOPES.map((s) => {
                    const active = scopes.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setScopes(active ? scopes.filter(x => x !== s.id) : [...scopes, s.id])}
                        className={`text-left p-2 rounded-lg border text-xs transition ${active ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:bg-muted'}`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={creating}>{creating ? "A criar…" : "Criar API"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}