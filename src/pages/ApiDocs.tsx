import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, BookOpen, Code, Globe, Lock, Zap, Wifi, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;
const SDK_URL = `${window.location.origin}/blynk-sdk.js`;

const endpoints = [
  { method: "POST", path: "/v1/auth/login", desc: "Autentica um utilizador (email + password). Devolve sessão JWT." },
  { method: "POST", path: "/v1/auth/signup", desc: "Cria nova conta no Blynk via API externa." },
  { method: "GET",  path: "/v1/posts", desc: "Lista publicações (limit ?limit=50)." },
  { method: "GET",  path: "/v1/posts/:id", desc: "Detalhe de uma publicação com autor." },
  { method: "POST", path: "/v1/posts", desc: "Cria publicação (requer Bearer session)." },
  { method: "DELETE", path: "/v1/posts/:id", desc: "Elimina publicação própria." },
  { method: "GET",  path: "/v1/profiles", desc: "Lista perfis de utilizadores." },
  { method: "GET",  path: "/v1/profiles/:id", desc: "Perfil completo de um utilizador." },
  { method: "GET",  path: "/v1/users/:id/followers", desc: "Seguidores de um utilizador." },
  { method: "GET",  path: "/v1/users/:id/following", desc: "Quem o utilizador segue." },
  { method: "GET",  path: "/v1/comments?post_id=", desc: "Comentários (todos ou de um post)." },
  { method: "POST", path: "/v1/comments", desc: "Comenta num post (Bearer)." },
  { method: "GET",  path: "/v1/likes?post_id=", desc: "Curtidas." },
  { method: "POST", path: "/v1/likes", desc: "Curte um post (Bearer)." },
  { method: "DELETE", path: "/v1/likes", desc: "Remove curtida (Bearer)." },
  { method: "POST", path: "/v1/follows", desc: "Segue um utilizador (Bearer)." },
  { method: "DELETE", path: "/v1/follows", desc: "Deixa de seguir (Bearer)." },
  { method: "GET",  path: "/v1/messages?user_id=", desc: "Mensagens do utilizador. Requer secret." },
  { method: "POST", path: "/v1/messages", desc: "Envia mensagem privada (Bearer)." },
  { method: "GET",  path: "/v1/stats", desc: "Estatísticas globais (posts, users, comments)." },
  { method: "GET",  path: "/v1/realtime/info", desc: "Devolve URL WebSocket + chave para o SDK realtime." },
];

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs overflow-x-auto font-mono">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost" size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition"
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); toast.success("Copiado"); setTimeout(() => setCopied(false), 1500); }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      {lang && <span className="absolute top-2 left-3 text-[10px] uppercase text-muted-foreground/60">{lang}</span>}
    </div>
  );
}

export default function ApiDocs() {
  const navigate = useNavigate();

  const curlExample = `curl -X GET "${BASE_URL}/v1/posts?limit=10" \\
  -H "X-API-Key: pk_live_xxx" \\
  -H "X-API-Secret: sk_live_xxx"`;

  const jsExample = `// JavaScript / Node / Browser
const res = await fetch("${BASE_URL}/v1/posts", {
  headers: {
    "X-API-Key": "pk_live_xxx",
    "X-API-Secret": "sk_live_xxx",
  },
});
const { data } = await res.json();
console.log(data);`;

  const loginExample = `// Login externo (usar a API do Blynk como backend de auth)
const res = await fetch("${BASE_URL}/v1/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "pk_live_xxx",
    "X-API-Secret": "sk_live_xxx",
  },
  body: JSON.stringify({ email, password }),
});
const { user, session } = await res.json();`;

  const phpExample = `<?php
$ch = curl_init("${BASE_URL}/v1/profiles");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "X-API-Key: pk_live_xxx",
  "X-API-Secret: sk_live_xxx",
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);
print_r($response['data']);`;

  const sdkExample = `<!-- Funciona em qualquer site/app web -->
<script src="${SDK_URL}"></script>
<script>
  const blynk = new Blynk({
    publicKey: "pk_live_xxx",
    secret:    "sk_live_xxx",
    baseUrl:   "${window.location.origin}",
  });

  // 1. Login com a tua conta Blynk (mesmo backend de auth)
  await blynk.auth.login("a@b.com", "password");

  // 2. Publicar — funciona offline, fica em fila e envia quando voltar online
  await blynk.posts.create({ content: "Olá mundo!" });

  // 3. Realtime — escuta novos posts em tempo real (WebSocket)
  blynk.realtime.on("posts",  (e) => console.log("post:", e));
  blynk.realtime.on("messages", (e) => console.log("nova msg:", e));
</script>`;

  const offlineExample = `// Modo offline-first (estilo Facebook antigo / Zero)
// O SDK guarda a ação em IndexedDB se estiver sem internet
// e re-envia automaticamente quando "online" voltar.

window.addEventListener("offline", () => console.log("offline mode ON"));
window.addEventListener("online",  () => console.log("a sincronizar fila..."));

// Esta chamada NUNCA falha por falta de internet:
await blynk.likes.like("post-uuid");
await blynk.comments.create("post-uuid", "Excelente!");
// Em segundo plano, a fila é drenada quando a ligação voltar.`;

  const realtimeExample = `// Realtime usa WebSocket sobre Supabase Realtime.
// O SDK trata da ligação por ti, mas se preferires
// podes integrar diretamente:
const info = await fetch("${BASE_URL}/v1/realtime/info", {
  headers: { "X-API-Key": "pk_live_xxx", "X-API-Secret": "sk_live_xxx" },
}).then(r => r.json());

// info.url      → wss://....supabase.co/realtime/v1
// info.anon_key → chave pública para a ligação WebSocket

const supa = supabase.createClient(info.url.replace("/realtime/v1","").replace("wss","https"), info.anon_key);
supa.channel("any").on("postgres_changes",
  { event: "*", schema: "public", table: "posts" },
  (payload) => console.log("evento posts:", payload),
).subscribe();`;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Blynk API · Documentação</h1>
            <p className="text-xs text-muted-foreground">Integra Blynk em qualquer site ou aplicativo</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-8">
        {/* Intro */}
        <section>
          <h2 className="text-2xl font-bold mb-2">Introdução</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A API REST do Blynk dá-te acesso programático a publicações, perfis, comentários, curtidas, mensagens e
            autenticação. Funciona a partir de qualquer domínio — usa-a como backend para um site novo, app móvel, ou para
            sincronizar dados entre Blynk e outras plataformas.
          </p>
        </section>

        {/* Base URL */}
        <section>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Globe className="h-4 w-4" /> Base URL</h2>
          <CodeBlock code={BASE_URL} />
        </section>

        {/* Auth */}
        <section>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Lock className="h-4 w-4" /> Autenticação</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Cada pedido precisa de dois headers: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">X-API-Key</code> (chave pública) e
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs ml-1">X-API-Secret</code> (chave secreta).
            Para escrever (criar posts, curtir, comentar, etc.) inclui também
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs ml-1">Authorization: Bearer &lt;session_jwt&gt;</code>
            obtido via <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/v1/auth/login</code>.
            Cria as tuas chaves em <button className="text-primary underline" onClick={() => navigate("/api-keys")}>/api-keys</button>.
          </p>
          <CodeBlock lang="bash" code={curlExample} />
        </section>

        {/* SDK */}
        <section>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4" /> SDK JavaScript</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Inclui <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{SDK_URL}</code> em qualquer site
            ou app web e ganhas REST + Realtime + fila offline (IndexedDB) prontos a usar.
          </p>
          <CodeBlock lang="html" code={sdkExample} />
        </section>

        {/* Realtime */}
        <section>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Zap className="h-4 w-4" /> Realtime (WebSocket)</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Recebe eventos em tempo real (novos posts, mensagens, curtidas, follows) através de uma ligação WebSocket.
            O SDK trata da ligação automaticamente.
          </p>
          <CodeBlock lang="javascript" code={realtimeExample} />
        </section>

        {/* Offline */}
        <section>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Wifi className="h-4 w-4" /> Modo offline · "Facebook Zero"</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Qualquer escrita feita pelo SDK é guardada em IndexedDB se o utilizador estiver sem internet
            e re-enviada automaticamente quando a ligação voltar — exactamente como o Facebook antigo.
            As leituras (fetch) podem ser cacheadas pela Service Worker do teu site.
          </p>
          <CodeBlock lang="javascript" code={offlineExample} />
        </section>

        {/* Endpoints */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Code className="h-4 w-4" /> Endpoints</h2>
          <Card className="divide-y divide-border">
            {endpoints.map((e) => (
              <div key={e.path} className="p-3 flex items-start gap-3">
                <Badge variant={e.method === "GET" ? "secondary" : "default"} className="font-mono text-[10px] shrink-0">
                  {e.method}
                </Badge>
                <div className="flex-1 min-w-0">
                  <code className="text-xs font-mono break-all">{e.path}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.desc}</p>
                </div>
              </div>
            ))}
          </Card>
        </section>

        {/* Examples */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Exemplos</h2>

          <div>
            <h3 className="text-sm font-medium mb-2">JavaScript / Fetch</h3>
            <CodeBlock lang="javascript" code={jsExample} />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Login externo</h3>
            <CodeBlock lang="javascript" code={loginExample} />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">PHP / cURL</h3>
            <CodeBlock lang="php" code={phpExample} />
          </div>
        </section>

        {/* Response format */}
        <section>
          <h2 className="text-lg font-semibold mb-2">Formato de resposta</h2>
          <CodeBlock lang="json" code={`{
  "data": [ ... ],
  "count": 10
}

// Em caso de erro:
{
  "error": "Invalid API key"
}`} />
        </section>

        {/* Rate limit */}
        <section>
          <h2 className="text-lg font-semibold mb-2">Limites</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>60 requisições / minuto por chave (configurável)</li>
            <li>Origens permitidas podem ser restringidas por chave</li>
            <li>Chaves podem ter data de expiração</li>
            <li>Todas as requisições ficam registadas em logs</li>
          </ul>
        </section>

        <p className="text-xs text-muted-foreground/60 text-center pt-8">© 2026/2027 Blynk API · v1</p>
      </div>
    </div>
  );
}