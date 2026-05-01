// Blynk Public REST API
// Authenticates with X-API-Key (public key) + X-API-Secret headers.
// Routes: GET /v1/posts, /v1/posts/:id, /v1/profiles, /v1/profiles/:id,
//         /v1/users/:id/followers, /v1/comments?post_id=, /v1/likes?post_id=,
//         /v1/messages?user_id=  (requires scope), /v1/stats
// Auth route:  POST /v1/auth/login  { email, password }  -> session
//              POST /v1/auth/signup { email, password, username }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-api-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const url = new URL(req.url);
  // Path can come as /functions/v1/public-api/v1/...  or  /public-api/v1/...
  const path = url.pathname.replace(/^\/functions\/v1\/public-api/, "").replace(/^\/public-api/, "") || "/";

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // --- Authenticate API key ---
  const publicKey = req.headers.get("x-api-key");
  const secret = req.headers.get("x-api-secret");
  if (!publicKey) return json({ error: "Missing X-API-Key header" }, 401);

  const { data: keyRow } = await admin
    .from("api_keys")
    .select("*")
    .eq("public_key", publicKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!keyRow) return json({ error: "Invalid API key" }, 401);
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return json({ error: "API key expired" }, 401);
  }

  // Secret is required for write/auth and any non-public scopes
  const needsSecret = req.method !== "GET" || path.startsWith("/v1/auth") || path.startsWith("/v1/messages");
  if (needsSecret) {
    if (!secret) return json({ error: "Missing X-API-Secret header" }, 401);
    const hash = await sha256(secret);
    if (hash !== keyRow.secret_key_hash) return json({ error: "Invalid API secret" }, 401);
  }

  const origin = req.headers.get("origin") || "";
  if (keyRow.allowed_origins?.length > 0 && origin && !keyRow.allowed_origins.includes(origin) && !keyRow.allowed_origins.includes("*")) {
    return json({ error: "Origin not allowed" }, 403);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const userAgent = req.headers.get("user-agent") || "";

  const logRequest = async (status: number, errorMessage?: string) => {
    await admin.from("api_request_logs").insert({
      api_key_id: keyRow.id,
      endpoint: path,
      method: req.method,
      status_code: status,
      ip_address: ip,
      user_agent: userAgent,
      origin,
      response_time_ms: Date.now() - startedAt,
      error_message: errorMessage,
    });
    await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
  };

  try {
    // --- Routes ---
    const seg = path.split("/").filter(Boolean); // ["v1","posts","..."]
    if (seg[0] !== "v1") {
      await logRequest(404, "Unknown path");
      return json({ error: "Not found", hint: "Use /v1/<resource>" }, 404);
    }

    // --- AUTH ---
    if (seg[1] === "auth") {
      if (seg[2] === "login" && req.method === "POST") {
        const { email, password } = await req.json();
        const anonClient = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
        const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
        if (error) { await logRequest(401, error.message); return json({ error: error.message }, 401); }
        await logRequest(200);
        return json({ user: data.user, session: data.session });
      }
      if (seg[2] === "signup" && req.method === "POST") {
        const { email, password, username, full_name } = await req.json();
        const anonClient = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
        const { data, error } = await anonClient.auth.signUp({
          email, password,
          options: { data: { username, full_name } },
        });
        if (error) { await logRequest(400, error.message); return json({ error: error.message }, 400); }
        await logRequest(200);
        return json({ user: data.user, session: data.session });
      }
      await logRequest(404);
      return json({ error: "Auth route not found" }, 404);
    }

    // --- POSTS ---
    if (seg[1] === "posts") {
      if (seg[2]) {
        const { data, error } = await admin.from("posts").select("*, profiles:user_id(id, username, full_name, avatar_url, verified)").eq("id", seg[2]).maybeSingle();
        if (error) throw error;
        await logRequest(200);
        return json({ data });
      }
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
      const { data, error } = await admin.from("posts").select("*, profiles:user_id(id, username, full_name, avatar_url, verified)").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      await logRequest(200);
      return json({ data, count: data?.length || 0 });
    }

    // --- PROFILES / USERS ---
    if (seg[1] === "profiles" || seg[1] === "users") {
      if (seg[2] === undefined) {
        const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
        const { data, error } = await admin.from("profiles").select("id, username, full_name, avatar_url, bio, verified, badge_type, created_at").limit(limit);
        if (error) throw error;
        await logRequest(200);
        return json({ data, count: data?.length || 0 });
      }
      if (seg[3] === "followers") {
        const { data, error } = await admin.from("follows").select("follower_id, created_at").eq("following_id", seg[2]);
        if (error) throw error;
        await logRequest(200);
        return json({ data, count: data?.length || 0 });
      }
      if (seg[3] === "following") {
        const { data, error } = await admin.from("follows").select("following_id, created_at").eq("follower_id", seg[2]);
        if (error) throw error;
        await logRequest(200);
        return json({ data, count: data?.length || 0 });
      }
      const { data, error } = await admin.from("profiles").select("*").eq("id", seg[2]).maybeSingle();
      if (error) throw error;
      await logRequest(200);
      return json({ data });
    }

    // --- COMMENTS ---
    if (seg[1] === "comments") {
      const postId = url.searchParams.get("post_id");
      let q = admin.from("comments").select("*, profiles:user_id(username, avatar_url)").order("created_at", { ascending: false }).limit(100);
      if (postId) q = q.eq("post_id", postId);
      const { data, error } = await q;
      if (error) throw error;
      await logRequest(200);
      return json({ data, count: data?.length || 0 });
    }

    // --- LIKES ---
    if (seg[1] === "likes") {
      const postId = url.searchParams.get("post_id");
      let q = admin.from("post_likes").select("*").limit(500);
      if (postId) q = q.eq("post_id", postId);
      const { data, error } = await q;
      if (error) throw error;
      await logRequest(200);
      return json({ data, count: data?.length || 0 });
    }

    // --- MESSAGES (sensitive: requires secret) ---
    if (seg[1] === "messages") {
      const userId = url.searchParams.get("user_id");
      if (!userId) { await logRequest(400); return json({ error: "user_id required" }, 400); }
      const { data, error } = await admin.from("messages").select("*").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      await logRequest(200);
      return json({ data, count: data?.length || 0 });
    }

    // --- STATS ---
    if (seg[1] === "stats") {
      const [posts, users, comments] = await Promise.all([
        admin.from("posts").select("*", { count: "exact", head: true }),
        admin.from("profiles").select("*", { count: "exact", head: true }),
        admin.from("comments").select("*", { count: "exact", head: true }),
      ]);
      await logRequest(200);
      return json({
        posts: posts.count || 0,
        users: users.count || 0,
        comments: comments.count || 0,
      });
    }

    await logRequest(404);
    return json({ error: "Resource not found" }, 404);
  } catch (e: any) {
    await logRequest(500, e.message);
    return json({ error: e.message || "Internal error" }, 500);
  }
});