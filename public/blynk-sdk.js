/*!
 * Blynk SDK v1.0  —  Public REST + Realtime + Offline queue (IndexedDB)
 *
 * Usage (in any external website or app):
 *
 *   <script src="https://blynks.lovable.app/blynk-sdk.js"></script>
 *   <script>
 *     const blynk = new Blynk({
 *       publicKey: "pk_live_xxx",
 *       secret:    "sk_live_xxx",            // keep on server in production
 *       baseUrl:   "https://blynks.lovable.app",
 *     });
 *
 *     await blynk.auth.login("a@b.com", "secret");
 *     await blynk.posts.create({ content: "Olá mundo!" });
 *
 *     blynk.realtime.on("posts", (event) => {
 *       console.log("novo evento de post:", event);
 *     });
 *   </script>
 *
 * Designed to work offline: any write is queued in IndexedDB and replayed
 * automatically when the browser comes back online.
 */
(function (global) {
  "use strict";

  // ----------- IndexedDB tiny helper -----------
  const DB_NAME = "blynk-sdk";
  const STORE = "outbox";
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function enqueue(item) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add({ ...item, queued_at: Date.now() });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  async function readAll() {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }
  async function removeItem(id) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  class Blynk {
    constructor(opts) {
      if (!opts || !opts.publicKey) throw new Error("Blynk: publicKey is required");
      this.publicKey = opts.publicKey;
      this.secret = opts.secret || "";
      this.baseUrl = (opts.baseUrl || "https://blynks.lovable.app").replace(/\/+$/, "");
      this.apiUrl = this.baseUrl + "/functions/v1/public-api";
      this.session = JSON.parse(localStorage.getItem("blynk_session") || "null");
      this._listeners = new Map();
      this._realtimeChannel = null;
      this._setupOnlineListener();

      // sub-namespaces
      this.auth = {
        login: (email, password) => this._post("/v1/auth/login", { email, password }, true).then((r) => this._setSession(r.session, r.user)),
        signup: (email, password, username, full_name) => this._post("/v1/auth/signup", { email, password, username, full_name }, true).then((r) => this._setSession(r.session, r.user)),
        logout: () => { this.session = null; localStorage.removeItem("blynk_session"); },
        currentUser: () => this.session?.user || null,
      };
      this.posts = {
        list: (limit = 50) => this._get(`/v1/posts?limit=${limit}`),
        get: (id) => this._get(`/v1/posts/${id}`),
        create: (data) => this._writeOrQueue("POST", "/v1/posts", data), // { content, media_urls? }
        delete: (id) => this._writeOrQueue("DELETE", `/v1/posts/${id}`, null),
      };
      this.comments = {
        list: (postId) => this._get(`/v1/comments${postId ? "?post_id=" + postId : ""}`),
        create: (postId, content) => this._writeOrQueue("POST", "/v1/comments", { post_id: postId, content }),
      };
      this.likes = {
        list: (postId) => this._get(`/v1/likes${postId ? "?post_id=" + postId : ""}`),
        like: (postId) => this._writeOrQueue("POST", "/v1/likes", { post_id: postId }),
        unlike: (postId) => this._writeOrQueue("DELETE", "/v1/likes", { post_id: postId }),
      };
      this.follows = {
        follow: (id) => this._writeOrQueue("POST", "/v1/follows", { following_id: id }),
        unfollow: (id) => this._writeOrQueue("DELETE", "/v1/follows", { following_id: id }),
      };
      this.messages = {
        list: (userId) => this._get(`/v1/messages?user_id=${userId}`),
        send: (receiverId, content, options = {}) => this._writeOrQueue("POST", "/v1/messages", { receiver_id: receiverId, content, ...options }),
      };
      this.payments = {
        createReference: (amount, options = {}) => this._writeOrQueue("POST", "/v1/payments/reference", { amount, ...options }),
        status: (paymentId) => this._get(`/v1/payments/${paymentId}/status`),
        check: (paymentId) => this._post("/v1/payments/check", { payment_id: paymentId }, false),
      };
      this.music = {
        list: (limit = 50) => this._get(`/v1/music?limit=${limit}`),
        trending: (limit = 50) => this._get(`/v1/music?trending=true&limit=${limit}`),
        create: (data) => this._writeOrQueue("POST", "/v1/music", data),
        play: (id) => this._writeOrQueue("POST", `/v1/music/${id}/play`, {}),
      };
      this.stories = {
        list: (limit = 50) => this._get(`/v1/stories?limit=${limit}`),
        byUser: (userId, limit = 50) => this._get(`/v1/stories?user_id=${userId}&limit=${limit}`),
        create: (data) => this._writeOrQueue("POST", "/v1/stories", data),
        delete: (id) => this._writeOrQueue("DELETE", `/v1/stories/${id}`, null),
      };
      this.profiles = {
        list: (limit = 50) => this._get(`/v1/profiles?limit=${limit}`),
        get: (id) => this._get(`/v1/profiles/${id}`),
        followers: (id) => this._get(`/v1/users/${id}/followers`),
        following: (id) => this._get(`/v1/users/${id}/following`),
      };
      this.stats = () => this._get("/v1/stats");

      // realtime via Supabase channels
      this.realtime = {
        on: (table, callback) => this._subscribe(table, callback),
        off: (table) => { this._listeners.delete(table); },
      };
    }

    _setSession(session, user) {
      this.session = { ...session, user };
      localStorage.setItem("blynk_session", JSON.stringify(this.session));
      return this.session;
    }

    _headers(includeSecret) {
      const h = { "Content-Type": "application/json", "X-API-Key": this.publicKey };
      if (includeSecret && this.secret) h["X-API-Secret"] = this.secret;
      if (this.session?.access_token) h["Authorization"] = "Bearer " + this.session.access_token;
      return h;
    }

    async _get(path) {
      const r = await fetch(this.apiUrl + path, { method: "GET", headers: this._headers(true) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Request failed");
      return j;
    }

    async _post(path, body, includeSecret = true) {
      const r = await fetch(this.apiUrl + path, {
        method: "POST",
        headers: this._headers(includeSecret),
        body: JSON.stringify(body || {}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Request failed");
      return j;
    }

    async _request(method, path, body) {
      const r = await fetch(this.apiUrl + path, {
        method,
        headers: this._headers(method === "GET"),
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Request failed");
      return j;
    }

    async _writeOrQueue(method, path, body) {
      if (!navigator.onLine) {
        await enqueue({ method, path, body });
        return { queued: true, offline: true };
      }
      try {
        return await this._request(method, path, body);
      } catch (e) {
        // Network failure → queue
        await enqueue({ method, path, body });
        return { queued: true, offline: true, error: e.message };
      }
    }

    _setupOnlineListener() {
      const flush = async () => {
        const items = await readAll();
        for (const it of items) {
          try {
            await this._request(it.method, it.path, it.body);
            await removeItem(it.id);
          } catch (e) {
            // stop on first failure to preserve order
            break;
          }
        }
      };
      window.addEventListener("online", flush);
      // try a flush on startup
      if (navigator.onLine) setTimeout(flush, 1500);
    }

    // --- Realtime via Supabase channels (loaded on demand) ---
    async _subscribe(table, callback) {
      this._listeners.set(table, callback);
      if (!this._supabaseClient) {
        const info = await this._get("/v1/realtime/info");
        if (!global.supabase) {
          await new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
          });
        }
        const supaUrl = info.url.replace("wss://", "https://").replace("/realtime/v1", "");
        this._supabaseClient = global.supabase.createClient(supaUrl, info.anon_key, {
          auth: { persistSession: false },
        });
        this._realtimeChannel = this._supabaseClient.channel("blynk-sdk");
      }
      this._realtimeChannel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        const cb = this._listeners.get(table);
        if (cb) cb(payload);
      });
      if (this._realtimeChannel.state !== "joined") {
        this._realtimeChannel.subscribe();
      }
    }
  }

  global.Blynk = Blynk;
})(typeof window !== "undefined" ? window : globalThis);