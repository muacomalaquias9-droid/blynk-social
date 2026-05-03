// Blynk Public REST API
// Authenticates with X-API-Key (public key) + X-API-Secret headers.
// For write operations the SDK additionally sends "Authorization: Bearer <session_jwt>"
// returned from /v1/auth/login.  The function validates the JWT against Supabase auth
// and then performs the operation on behalf of that user.
//
// Read:   GET /v1/posts, /v1/posts/:id, /v1/profiles, /v1/profiles/:id,
//         /v1/users/:id/followers, /v1/users/:id/following,
//         /v1/comments?post_id=, /v1/likes?post_id=,
//         /v1/messages?user_id=  (requires secret), /v1/stats,
//         /v1/realtime/info  (returns Supabase realtime URL + anon key)
// Auth:   POST /v1/auth/login   { email, password }  -> { user, session }
//         POST /v1/auth/signup  { email, password, username }
// Write (require Bearer session):
//         POST   /v1/posts                  { content, image_url? }
//         DELETE /v1/posts/:id
//         POST   /v1/comments               { post_id, content }
//         POST   /v1/likes                  { post_id }
//         DELETE /v1/likes                  { post_id }
//         POST   /v1/follows                { following_id }
//         DELETE /v1/follows                { following_id }
//         POST   /v1/messages               { receiver_id, content }
//         POST   /v1/payments/reference      { amount, title?, plan_type?, customer? }
//         GET    /v1/payments/:id/status
//         GET    /v1/music, POST /v1/music, POST /v1/music/:id/play
//         GET    /v1/stories, POST /v1/stories, DELETE /v1/stories/:id

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-api-secret",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

  // Only sensitive reads (direct messages) require the secret. Auth (login/signup)
  // and writes work with just the public key + user's Bearer token, so mobile apps
  // (Dart/Flutter, React Native, native iOS/Android) can sign users in without
  // shipping the secret in the binary.
  const needsSecret = path.startsWith("/v1/messages") && req.method === "GET";
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

  // Resolve current user from Authorization Bearer header (optional, required for writes)
  const getCurrentUser = async (): Promise<{ id: string } | null> => {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id };
  };

  const requireUser = async () => {
    const u = await getCurrentUser();
    if (!u) {
      await logRequest(401, "Missing or invalid Bearer token");
      return { user: null as any, response: json({ error: "Authorization Bearer <session_jwt> required" }, 401) };
    }
    return { user: u, response: null };
  };


  const createReferencePayment = async (userId: string, body: any) => {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { response: json({ error: "amount must be a positive number" }, 400) };
    }

    const PLIQPAY_PUBLIC_KEY = Deno.env.get("PLIQPAY_API_KEY");
    if (!PLIQPAY_PUBLIC_KEY) {
      return { response: json({ error: "Payment provider is not configured" }, 503) };
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("first_name, full_name, email, phone")
      .eq("id", userId)
      .maybeSingle();

    const title = String(body.title || body.description || "Pagamento Blynk").slice(0, 120);
    const planType = String(body.plan_type || body.type || "api_payment").slice(0, 40);
    const externalId = `api_${userId}_${Date.now()}`;
    const callbackUrl = `${SUPABASE_URL}/functions/v1/payment-webhook`;
    const customer = body.customer || {};

    const pliqResponse = await fetch("https://api.plinqpay.com/v1/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": PLIQPAY_PUBLIC_KEY },
      body: JSON.stringify({
        externalId,
        callbackUrl,
        method: "REFERENCE",
        client: {
          name: customer.name || profile?.full_name || profile?.first_name || "Cliente Blynk",
          email: customer.email || profile?.email || "",
          phone: customer.phone || profile?.phone || "+244900000000",
        },
        items: [{ title, price: amount, quantity: 1 }],
        amount,
      }),
    });

    const responseText = await pliqResponse.text();
    if (!pliqResponse.ok) {
      return { response: json({ error: `PlinqPay error [${pliqResponse.status}]`, details: responseText }, 502) };
    }

    let pliqData: any = {};
    try { pliqData = JSON.parse(responseText); } catch {
      return { response: json({ error: "Invalid payment provider response" }, 502) };
    }

    const paymentReference = pliqData.reference || pliqData.data?.reference || null;
    const paymentEntity = pliqData.entity || pliqData.data?.entity || "01055";
    const transactionId = pliqData.id || pliqData.data?.id || null;

    const { data: subscription, error } = await admin
      .from("verification_subscriptions")
      .insert({
        user_id: userId,
        plan_type: planType,
        amount,
        status: "pending",
        payment_reference: paymentReference,
        external_id: externalId,
        transaction_id: transactionId,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      response: json({
        success: true,
        data: subscription,
        payment: {
          id: subscription.id,
          status: subscription.status,
          amount,
          reference: paymentReference,
          entity: paymentEntity,
          transaction_id: transactionId,
          expires_at: subscription.expires_at,
          instructions: "Pague por Referência/Entidade no Multicaixa Express ou ATM.",
        },
        provider: pliqData,
      }, 201),
    };
  };

  try {
    // --- Routes ---
    const seg = path.split("/").filter(Boolean); // ["v1","posts","..."]
    if (seg[0] !== "v1") {
      await logRequest(404, "Unknown path");
      return json({ error: "Not found", hint: "Use /v1/<resource>" }, 404);
    }

    // --- REALTIME INFO ---
    if (seg[1] === "realtime" && seg[2] === "info") {
      await logRequest(200);
      return json({
        url: SUPABASE_URL.replace("https://", "wss://") + "/realtime/v1",
        anon_key: ANON,
        hint: "Use the supabase-js client with this URL + anon key, then subscribe to postgres_changes on tables like 'posts', 'comments', 'post_likes', 'follows', 'messages'.",
      });
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
      // Create post
      if (!seg[2] && req.method === "POST") {
        const { user, response } = await requireUser();
        if (response) return response;
        const body = await req.json();
        if (!body.content && !(Array.isArray(body.media_urls) && body.media_urls.length)) {
          await logRequest(400, "content or media_urls required");
          return json({ error: "content or media_urls required" }, 400);
        }
        const { data, error } = await admin.from("posts").insert({
          user_id: user.id,
          content: body.content || "",
          media_urls: body.media_urls || null,
          visibility: body.visibility || "public",
        }).select().single();
        if (error) throw error;
        await logRequest(201);
        return json({ data }, 201);
      }
      // Delete post
      if (seg[2] && req.method === "DELETE") {
        const { user, response } = await requireUser();
        if (response) return response;
        const { error } = await admin.from("posts").delete().eq("id", seg[2]).eq("user_id", user.id);
        if (error) throw error;
        await logRequest(200);
        return json({ success: true });
      }
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
      if (req.method === "POST") {
        const { user, response } = await requireUser();
        if (response) return response;
        const body = await req.json();
        if (!body.post_id || !body.content) {
          await logRequest(400);
          return json({ error: "post_id and content required" }, 400);
        }
        const { data, error } = await admin.from("comments").insert({
          user_id: user.id,
          post_id: body.post_id,
          content: body.content,
        }).select().single();
        if (error) throw error;
        await logRequest(201);
        return json({ data }, 201);
      }
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
      if (req.method === "POST" || req.method === "DELETE") {
        const { user, response } = await requireUser();
        if (response) return response;
        const body = await req.json();
        if (!body.post_id) { await logRequest(400); return json({ error: "post_id required" }, 400); }
        if (req.method === "POST") {
          const { data, error } = await admin.from("post_likes").upsert({
            user_id: user.id, post_id: body.post_id,
          }, { onConflict: "user_id,post_id" }).select().maybeSingle();
          if (error) throw error;
          await logRequest(201);
          return json({ data }, 201);
        } else {
          const { error } = await admin.from("post_likes").delete().eq("user_id", user.id).eq("post_id", body.post_id);
          if (error) throw error;
          await logRequest(200);
          return json({ success: true });
        }
      }
      const postId = url.searchParams.get("post_id");
      let q = admin.from("post_likes").select("*").limit(500);
      if (postId) q = q.eq("post_id", postId);
      const { data, error } = await q;
      if (error) throw error;
      await logRequest(200);
      return json({ data, count: data?.length || 0 });
    }

    // --- FOLLOWS ---
    if (seg[1] === "follows") {
      if (req.method === "POST" || req.method === "DELETE") {
        const { user, response } = await requireUser();
        if (response) return response;
        const body = await req.json();
        if (!body.following_id) { await logRequest(400); return json({ error: "following_id required" }, 400); }
        if (req.method === "POST") {
          const { data, error } = await admin.from("follows").upsert({
            follower_id: user.id, following_id: body.following_id,
          }, { onConflict: "follower_id,following_id" }).select().maybeSingle();
          if (error) throw error;
          await logRequest(201);
          return json({ data }, 201);
        } else {
          const { error } = await admin.from("follows").delete().eq("follower_id", user.id).eq("following_id", body.following_id);
          if (error) throw error;
          await logRequest(200);
          return json({ success: true });
        }
      }
      await logRequest(405);
      return json({ error: "Method not allowed" }, 405);
    }

    // --- MESSAGES (sensitive: requires secret) ---
    if (seg[1] === "messages") {
      if (req.method === "POST") {
        const { user, response } = await requireUser();
        if (response) return response;
        const body = await req.json();
        if (!body.receiver_id || (!body.content && !body.media_url)) { await logRequest(400); return json({ error: "receiver_id and content or media_url required" }, 400); }
        const { data, error } = await admin.from("messages").insert({
          sender_id: user.id,
          receiver_id: body.receiver_id,
          content: body.content || "",
          media_url: body.media_url || null,
          message_type: body.message_type || (body.media_url ? "media" : "text"),
          duration: body.duration || null,
          view_once: body.view_once || false,
        }).select().single();
        if (error) throw error;
        await logRequest(201);
        return json({ data }, 201);
      }
      const userId = url.searchParams.get("user_id");
      if (!userId) { await logRequest(400); return json({ error: "user_id required" }, 400); }
      const { data, error } = await admin.from("messages").select("*").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      await logRequest(200);
      return json({ data, count: data?.length || 0 });
    }

    // --- PAYMENTS (PliqPay reference/entity) ---
    if (seg[1] === "payments") {
      if (seg[2] === "reference" && req.method === "POST") {
        const { user, response } = await requireUser();
        if (response) return response;
        const body = await req.json();
        const result = await createReferencePayment(user.id, body);
        await logRequest(result.response.status);
        return result.response;
      }

      if (seg[3] === "status" && req.method === "GET") {
        const { user, response } = await requireUser();
        if (response) return response;
        const { data, error } = await admin
          .from("verification_subscriptions")
          .select("id, amount, plan_type, status, payment_reference, transaction_id, external_id, paid_at, expires_at, created_at")
          .eq("id", seg[2])
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (!data) { await logRequest(404); return json({ error: "payment not found" }, 404); }
        await logRequest(200);
        return json({ data, payment: { ...data, reference: data.payment_reference, entity: "01055" } });
      }

      if (seg[2] === "check" && req.method === "POST") {
        const { user, response } = await requireUser();
        if (response) return response;
        const body = await req.json();
        if (!body.subscription_id && !body.payment_id) { await logRequest(400); return json({ error: "subscription_id or payment_id required" }, 400); }
        const id = body.subscription_id || body.payment_id;
        const { data, error } = await admin
          .from("verification_subscriptions")
          .select("id, amount, plan_type, status, payment_reference, transaction_id, external_id, paid_at, expires_at, created_at")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (!data) { await logRequest(404); return json({ error: "payment not found" }, 404); }
        await logRequest(200);
        return json({ success: true, status: data.status, data, payment: { ...data, reference: data.payment_reference, entity: "01055" } });
      }

      await logRequest(404);
      return json({ error: "Payments route not found" }, 404);
    }

    // --- MUSIC ---
    if (seg[1] === "music") {
      if (seg[2] && seg[3] === "play" && req.method === "POST") {
        const { data: current, error: getError } = await admin.from("trending_music").select("play_count").eq("id", seg[2]).maybeSingle();
        if (getError) throw getError;
        if (!current) { await logRequest(404); return json({ error: "music not found" }, 404); }
        const { data, error } = await admin.from("trending_music").update({ play_count: (current.play_count || 0) + 1 }).eq("id", seg[2]).select().single();
        if (error) throw error;
        await logRequest(200);
        return json({ data });
      }

      if (req.method === "POST") {
        const { user, response } = await requireUser();
        if (response) return response;
        const body = await req.json();
        if (!body.name || !body.artist || !body.audio_url) { await logRequest(400); return json({ error: "name, artist and audio_url required" }, 400); }
        const { data, error } = await admin.from("trending_music").insert({
          name: String(body.name).slice(0, 120),
          artist: String(body.artist).slice(0, 120),
          audio_url: body.audio_url,
          cover_url: body.cover_url || null,
          duration: Number(body.duration || 0),
          is_trending: body.is_trending ?? false,
        }).select().single();
        if (error) throw error;
        await logRequest(201);
        return json({ data }, 201);
      }

      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
      let q = admin.from("trending_music").select("*").order("created_at", { ascending: false }).limit(limit);
      if (url.searchParams.get("trending") === "true") q = q.eq("is_trending", true);
      const { data, error } = await q;
      if (error) throw error;
      await logRequest(200);
      return json({ data, count: data?.length || 0 });
    }

    // --- STORIES ---
    if (seg[1] === "stories") {
      if (!seg[2] && req.method === "POST") {
        const { user, response } = await requireUser();
        if (response) return response;
        const body = await req.json();
        if (!body.media_url || !body.media_type) { await logRequest(400); return json({ error: "media_url and media_type required" }, 400); }
        const { data, error } = await admin.from("stories").insert({
          user_id: user.id,
          media_url: body.media_url,
          media_type: body.media_type,
          music_name: body.music_name || null,
          music_artist: body.music_artist || null,
          custom_music_url: body.custom_music_url || null,
          expires_at: body.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }).select().single();
        if (error) throw error;
        await logRequest(201);
        return json({ data }, 201);
      }

      if (seg[2] && req.method === "DELETE") {
        const { user, response } = await requireUser();
        if (response) return response;
        const { error } = await admin.from("stories").delete().eq("id", seg[2]).eq("user_id", user.id);
        if (error) throw error;
        await logRequest(200);
        return json({ success: true });
      }

      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
      let q = admin
        .from("stories")
        .select("*, profiles:user_id(id, username, first_name, full_name, avatar_url, verified)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(limit);
      if (url.searchParams.get("user_id")) q = q.eq("user_id", url.searchParams.get("user_id"));
      const { data, error } = await q;
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