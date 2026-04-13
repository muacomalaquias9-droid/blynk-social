import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await userClient.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Not admin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { type, targetUserId, amount } = body;

    if (!type || !targetUserId || !amount) {
      return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role to bypass RLS and FK constraints
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (type === "likes") {
      // Get user's latest posts
      const { data: posts } = await adminClient.from("posts").select("id").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(5);
      if (!posts || posts.length === 0) {
        return new Response(JSON.stringify({ error: "No posts found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let added = 0;
      for (const post of posts) {
        const likesPerPost = Math.ceil(amount / posts.length);
        for (let i = 0; i < likesPerPost && added < amount; i++) {
          // Use post_likes instead of post_reactions - it may not have FK on user_id
          // Actually both have FK. We need to use existing real user IDs.
          // Get random real users from profiles
          const { data: randomUsers } = await adminClient
            .from("profiles")
            .select("id")
            .neq("id", targetUserId)
            .limit(1)
            .order("created_at", { ascending: false });
          
          // Insert like using the admin user's ID with upsert to avoid duplicates
          // Actually let's just insert into post_likes using real user IDs
          // Get batch of real users
          if (added === 0) {
            // Pre-fetch real user IDs
            break;
          }
        }
      }

      // Better approach: fetch real user IDs once, then distribute likes
      const { data: realUsers } = await adminClient
        .from("profiles")
        .select("id")
        .neq("id", targetUserId)
        .limit(Math.min(amount, 500));

      if (!realUsers || realUsers.length === 0) {
        return new Response(JSON.stringify({ error: "No users available for boost" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      added = 0;
      for (const post of posts) {
        const likesPerPost = Math.ceil(amount / posts.length);
        for (let i = 0; i < likesPerPost && added < amount; i++) {
          const randomUser = realUsers[added % realUsers.length];
          // Try insert, ignore duplicates
          await adminClient.from("post_likes").upsert(
            { post_id: post.id, user_id: randomUser.id },
            { onConflict: "post_id,user_id", ignoreDuplicates: true }
          );
          added++;
        }
      }

      return new Response(JSON.stringify({ success: true, added }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "followers") {
      const { data: realUsers } = await adminClient
        .from("profiles")
        .select("id")
        .neq("id", targetUserId)
        .limit(Math.min(amount, 500));

      if (!realUsers || realUsers.length === 0) {
        return new Response(JSON.stringify({ error: "No users available" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let added = 0;
      for (let i = 0; i < Math.min(amount, realUsers.length); i++) {
        const { error } = await adminClient.from("follows").upsert(
          { follower_id: realUsers[i].id, following_id: targetUserId },
          { onConflict: "follower_id,following_id", ignoreDuplicates: true }
        );
        if (!error) added++;
      }

      return new Response(JSON.stringify({ success: true, added }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
