/* ============================================================
   Onlu Members — accounts, events, profiles and follows (Vercel function)

   One endpoint, chosen with ?a=:
     POST signup  { code?, name, email, password }  (code = an event's code, optional)
     POST login   { email, password }
     POST logout
     GET  config                          → public settings (Google client id)
     POST google  { credential, code? }   → sign in or join with Google
     POST reset   { token, password }     → set a new password from a reset link
     POST resetlink { id }                → (admin) make a one-time reset link
     POST join    { code }                → add another event I attended
     GET  me                              → my profile, my events, follows
     POST profile { …fields }
     GET  people                          → members who share an event with me
     POST follow  { id }   POST unfollow { id }
     GET  card    ?id=                   → a member's public card (from their QR)
     POST connect { id, code? }          → follow someone whose QR I scanned;
                                           the QR's event code adds me to that
                                           event if I wasn't in it yet
     GET  events                          → (admin) every event with head counts
     POST event   { name, date }          → (admin) create an event and its code
     GET  export                          → (admin) every member's full record
     GET  news                            → Onlu Brief stories the host posted (public)
     POST news-add { title, … }           → (admin) post a story
     POST news-del { id }                 → (admin) remove a posted story

   Rules, enforced here and nowhere else:
   • Anyone can make an account, but they see no one (and no one sees them)
     until they add the code of an event they attended.
   • Members see only people who attended at least one of the same events.
     The admin (the host) sees everyone.
   • You can follow only people you share an event with.
   • Socials (LinkedIn, Instagram, WeChat, email, phone) are returned only
     between two members who follow each other.

   Needs the Upstash Redis connection (see README) and:
     ONLU_ADMIN_EMAIL – host email(s), comma-separated; defaults to hello@onlu.ai.
                        Hosts see every member and are the only ones who can
                        create events.
   Optional: SESSION_SECRET (defaults to a key derived from the Redis token).
   Google sign-in uses GOOGLE_CLIENT_ID below (a public id, not a secret).
   ============================================================ */

const crypto = require("crypto");
const { redis, pipeline, configured, token } = require("./_redis");

// one or more host emails, comma-separated; quotes pasted around the value are ignored.
// Without the variable, the Onlu account is the host (its login email is already registered,
// so no one else can sign up with it).
const DEFAULT_HOST = "hello@onlu.ai";
const ADMINS = String(process.env.ONLU_ADMIN_EMAIL || DEFAULT_HOST).split(",")
  .map((e) => e.trim().replace(/^["']+|["']+$/g, "").trim().toLowerCase()).filter(Boolean);
const ADMIN = ADMINS[0] || "";
const SECRET = process.env.SESSION_SECRET || crypto.createHash("sha256").update("onlu-session:" + (token || "")).digest("hex");
// Google sign-in: the OAuth "Web application" client id from Google Cloud Console.
// It is public (it ships in the page anyway), so it can live here or in GOOGLE_CLIENT_ID.
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const TOKENINFO = process.env.GOOGLE_TOKENINFO_URL || "https://oauth2.googleapis.com/tokeninfo";
const COOKIE = "onlu_s";
const MONTH = 60 * 60 * 24 * 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^[a-z0-9-]{3,40}$/;

const PUBLIC = ["n", "r", "o", "v", "mb", "hm", "lg", "ask"];
const PRIVATE = ["li", "ig", "wc", "em", "ph"];
const NEWS_AREAS = ["Credit", "Macro", "AI", "Tech", "Healthcare", "Consumer", "Real estate", "Resources"];
const VERTICALS = ["Credit", "Quant & trading", "PE & real assets", "Investment banking", "Research & strategy", "AI & tech", "Healthcare", "Other"];

// ---------- helpers ----------
const send = (res, code, obj) => res.status(code).json(obj);
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const normCode = (v) => str(v, 40).toLowerCase().replace(/\s+/g, "");
function rid(n) {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789", b = crypto.randomBytes(n);
  let o = ""; for (let i = 0; i < n; i++) o += abc[b[i] % abc.length];
  return o;
}
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString("hex");

function sign(uid) {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + MONTH * 1000 })).toString("base64url");
  return body + "." + crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
}
function verify(tok) {
  if (!tok || tok.indexOf(".") < 0) return null;
  const [body, mac] = tok.split(".");
  const want = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (!mac || mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(body, "base64url").toString());
    return exp > Date.now() ? uid : null;
  } catch (e) { return null; }
}
function readCookie(req) {
  const m = String(req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}
function setSession(res, uid) {
  res.setHeader("Set-Cookie", `${COOKIE}=${uid ? sign(uid) : ""}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${uid ? MONTH : 0}`);
}

function cleanProfile(input, prev) {
  const out = Object.assign({}, prev);
  for (const k of PUBLIC) if (k in input) out[k] = str(input[k], k === "o" ? 160 : 80);
  if (out.v && VERTICALS.indexOf(out.v) < 0) out.v = "";
  if (input.av !== undefined) {
    out.av = input.av && typeof input.av.e === "string" && input.av.e
      ? { e: input.av.e.slice(0, 8), c: Math.max(0, Math.min(4, input.av.c | 0)) } : null;
  }
  out.s = Object.assign({}, prev.s || {});
  for (const k of PRIVATE) if (input.s && k in input.s) out.s[k] = str(input.s[k], 160);
  if (!out.n) out.n = prev.n;
  out.updated = Date.now();
  return out;
}

function publicView(u) {
  const o = { id: u.id };
  for (const k of PUBLIC) if (u[k]) o[k] = u[k];
  if (u.av) o.av = u.av;
  return o;
}

async function getUser(id) {
  const raw = await redis(["GET", `user:${id}`]);
  return raw ? JSON.parse(raw) : null;
}
async function getEvents(codes) {
  if (!codes.length) return {};
  const raws = await redis(["MGET", ...codes.map((c) => `event:${c}`)]);
  const out = {};
  raws.forEach((r, i) => { if (r) out[codes[i]] = JSON.parse(r); });
  return out;
}
const isAdmin = (u) => Boolean(u && u.le && ADMINS.indexOf(String(u.le).toLowerCase()) > -1);

// who shares an event with me: id → [codes]
async function sharedMap(me) {
  const codes = me.ev || [];
  const lists = await pipeline(codes.map((c) => ["SMEMBERS", `evm:${c}`]));
  const map = {};
  lists.forEach((ids, i) => ids.forEach((id) => { if (id !== me.id) (map[id] = map[id] || []).push(codes[i]); }));
  return map;
}

async function addToEvent(user, code) {
  user.ev = Array.from(new Set((user.ev || []).concat(code)));
  await pipeline([["SET", `user:${user.id}`, JSON.stringify(user)], ["SADD", `evm:${code}`, user.id]]);
}

// ---------- handler ----------
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!configured) return send(res, 503, { error: "The members area isn't set up yet." });
  const a = String((req.query && req.query.a) || "");
  const body = typeof req.body === "object" && req.body ? req.body : {};
  const isPost = req.method === "POST";

  try {
    // ----- public actions -----
    if (a === "signup" && isPost) {
      const email = str(body.email, 120).toLowerCase(), pw = String(body.password || ""), name = str(body.name, 80);
      const code = normCode(body.code);
      if (code && (!CODE_RE.test(code) || !(await redis(["EXISTS", `event:${code}`])))) {
        return send(res, 403, { error: "That event code isn't right. Ask Karlie for the code from your Onlu event." });
      }
      if (!name) return send(res, 400, { error: "Add your name." });
      if (!EMAIL_RE.test(email)) return send(res, 400, { error: "Enter a valid email." });
      if (pw.length < 8) return send(res, 400, { error: "Use a password of at least 8 characters." });
      if (await redis(["GET", `login:${email}`])) return send(res, 409, { error: "There's already an account with this email. Sign in instead." });
      const id = rid(12), salt = rid(16);
      const user = cleanProfile({ n: name }, { id, n: name, le: email, ev: [], s: { em: email }, created: Date.now() });
      await pipeline([
        ["SET", `login:${email}`, JSON.stringify({ id, salt, hash: hashPw(pw, salt) })],
        ["SET", `user:${id}`, JSON.stringify(user)],
        ["SADD", "members", id],
      ]);
      if (code) await addToEvent(user, code);
      setSession(res, id);
      return send(res, 200, { ok: true });
    }

    if (a === "login" && isPost) {
      const email = str(body.email, 120).toLowerCase(), pw = String(body.password || "");
      const [tries] = await pipeline([["INCR", `rl:${email}`], ["EXPIRE", `rl:${email}`, 900]]);
      if (tries > 10) return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
      const raw = await redis(["GET", `login:${email}`]);
      const rec = raw ? JSON.parse(raw) : null;
      if (rec && !rec.hash) return send(res, 401, { error: "This account signs in with Google. Use the Google button." });
      const got = Buffer.from(hashPw(pw, rec ? rec.salt : "x"), "hex");
      const want = Buffer.from(rec ? rec.hash : "0".repeat(64), "hex");
      if (!rec || !crypto.timingSafeEqual(got, want)) return send(res, 401, { error: "Email or password doesn't match." });
      await redis(["DEL", `rl:${email}`]);
      setSession(res, rec.id);
      return send(res, 200, { ok: true });
    }

    if (a === "logout" && isPost) { setSession(res, ""); return send(res, 200, { ok: true }); }

    if (a === "config" && req.method === "GET") return send(res, 200, { googleClientId: GOOGLE_CLIENT_ID });

    if (a === "news" && req.method === "GET") {
      const raw = await redis(["GET", "news"]);
      return send(res, 200, { items: raw ? JSON.parse(raw) : [] });
    }

    if (a === "google" && isPost) {
      if (!GOOGLE_CLIENT_ID) return send(res, 503, { error: "Google sign-in isn't set up yet." });
      const cred = String(body.credential || "");
      if (!cred || cred.length > 4096) return send(res, 400, { error: "Google didn't send a sign-in token." });
      const r = await fetch(TOKENINFO + "?id_token=" + encodeURIComponent(cred));
      const t = r.ok ? await r.json() : null;
      const iss = t && String(t.iss || "");
      if (!t || t.aud !== GOOGLE_CLIENT_ID || (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") ||
          String(t.email_verified) !== "true" || Number(t.exp) * 1000 < Date.now()) {
        return send(res, 401, { error: "Google sign-in couldn't be verified. Try again." });
      }
      const email = String(t.email || "").toLowerCase();
      if (!EMAIL_RE.test(email)) return send(res, 400, { error: "Your Google account has no usable email." });
      const raw = await redis(["GET", `login:${email}`]);
      let rec = raw ? JSON.parse(raw) : null, created = false;
      if (rec && !(await redis(["EXISTS", `user:${rec.id}`]))) rec = null;
      if (rec) {
        if (!rec.google) { rec.google = true; await redis(["SET", `login:${email}`, JSON.stringify(rec)]); }
      } else {
        // a new member: Google has verified this email
        const id = rid(12), name = str(t.name, 80) || email.split("@")[0];
        const user = cleanProfile({ n: name }, { id, n: name, le: email, ev: [], s: { em: email }, created: Date.now() });
        rec = { id, google: true };
        await pipeline([["SET", `login:${email}`, JSON.stringify(rec)], ["SET", `user:${id}`, JSON.stringify(user)], ["SADD", "members", id]]);
        created = true;
      }
      const code = normCode(body.code);
      if (code && CODE_RE.test(code) && (await redis(["EXISTS", `event:${code}`]))) {
        const u = await getUser(rec.id);
        if (u && (u.ev || []).indexOf(code) < 0) await addToEvent(u, code);
      }
      setSession(res, rec.id);
      return send(res, 200, { ok: true, created });
    }

    if (a === "reset" && isPost) {
      const tok = str(body.token, 60), pw = String(body.password || "");
      if (pw.length < 8) return send(res, 400, { error: "Use a password of at least 8 characters." });
      const raw = /^[a-z0-9]{20,60}$/.test(tok) ? await redis(["GET", `reset:${tok}`]) : null;
      const r = raw ? JSON.parse(raw) : null;
      const u = r && r.exp > Date.now() ? await getUser(r.id) : null;
      if (!u || !u.le) return send(res, 400, { error: "This reset link has expired or was already used. Ask Karlie for a new one." });
      const lraw = await redis(["GET", `login:${u.le}`]);
      const rec = Object.assign(lraw ? JSON.parse(lraw) : {}, { id: u.id });
      rec.salt = rid(16); rec.hash = hashPw(pw, rec.salt);
      await pipeline([["SET", `login:${u.le}`, JSON.stringify(rec)], ["DEL", `reset:${tok}`], ["DEL", `rl:${u.le}`]]);
      setSession(res, u.id);
      return send(res, 200, { ok: true });
    }

    if (a === "card" && req.method === "GET") {
      const id = str(req.query && req.query.id, 20);
      const u = /^[a-z0-9]{8,20}$/.test(id) ? await getUser(id) : null;
      if (!u) return send(res, 404, { error: "This card wasn't found." });
      return send(res, 200, { card: publicView(u) });
    }

    // ----- signed-in actions -----
    const uid = verify(readCookie(req));
    const me = uid ? await getUser(uid) : null;
    if (!me) return send(res, 401, { error: "Please sign in." });
    const admin = isAdmin(me);

    if (a === "me" && req.method === "GET") {
      const [following, followers] = await pipeline([["SMEMBERS", `follows:${uid}`], ["SMEMBERS", `followers:${uid}`]]);
      const view = Object.assign({}, me); delete view.le;
      // hostSetup helps diagnose: is the variable visible to this deployment, and does my login email match it?
      const hostSetup = { variableFound: Boolean(process.env.ONLU_ADMIN_EMAIL), hosts: ADMINS, signedInAs: me.le || "(unknown: account made before host support)" };
      return send(res, 200, { me: view, admin, hostSetup, events: await getEvents(me.ev || []), following, followers, verticals: VERTICALS });
    }

    if (a === "profile" && isPost) {
      const next = cleanProfile(body, me);
      await redis(["SET", `user:${uid}`, JSON.stringify(next)]);
      const view = Object.assign({}, next); delete view.le;
      return send(res, 200, { me: view });
    }

    if (a === "join" && isPost) {
      const code = normCode(body.code);
      if (!CODE_RE.test(code) || !(await redis(["EXISTS", `event:${code}`]))) return send(res, 404, { error: "That event code isn't right." });
      if ((me.ev || []).indexOf(code) > -1) return send(res, 200, { ok: true, already: true });
      await addToEvent(me, code);
      return send(res, 200, { ok: true });
    }

    if (a === "people" && req.method === "GET") {
      const [following, followers] = await pipeline([["SMEMBERS", `follows:${uid}`], ["SMEMBERS", `followers:${uid}`]]);
      const shared = await sharedMap(me);
      let ids = Object.keys(shared);
      if (admin) ids = (await redis(["SMEMBERS", "members"])).filter((x) => x !== uid);
      const raws = ids.length ? await redis(["MGET", ...ids.map((x) => `user:${x}`)]) : [];
      const iFollow = new Set(following), followsMe = new Set(followers);
      const codes = new Set();
      const people = raws.filter(Boolean).map((raw) => {
        const u = JSON.parse(raw), p = publicView(u);
        p.events = admin ? (u.ev || []) : (shared[u.id] || []);
        p.events.forEach((c) => codes.add(c));
        p.iFollow = iFollow.has(u.id);
        p.followsMe = followsMe.has(u.id);
        if (p.iFollow && p.followsMe) p.s = u.s || {};   // mutual only
        p.updated = u.updated;
        return p;
      }).sort((x, y) => (y.updated || 0) - (x.updated || 0));
      return send(res, 200, { people, events: await getEvents(Array.from(codes)) });
    }

    if ((a === "follow" || a === "unfollow") && isPost) {
      const target = str(body.id, 20);
      if (!target || target === uid || !(await redis(["EXISTS", `user:${target}`]))) return send(res, 400, { error: "That member wasn't found." });
      if (a === "follow" && !admin) {
        const shared = await sharedMap(me);
        if (!shared[target]) return send(res, 403, { error: "You can follow people from the events you attended." });
      }
      const op = a === "follow" ? "SADD" : "SREM";
      await pipeline([[op, `follows:${uid}`, target], [op, `followers:${target}`, uid]]);
      return send(res, 200, { ok: true });
    }

    if (a === "connect" && isPost) {
      const target = str(body.id, 20), code = normCode(body.code);
      if (!target || !(await redis(["EXISTS", `user:${target}`]))) return send(res, 404, { error: "That member wasn't found." });
      if (target === uid) return send(res, 400, { error: "That's your own QR." });
      if (code) {
        // the QR carries an event its owner attended; scanning it in person lets me join that event
        if (!CODE_RE.test(code) || !(await redis(["SISMEMBER", `evm:${code}`, target]))) return send(res, 403, { error: "That QR's event code isn't valid." });
        if ((me.ev || []).indexOf(code) < 0) await addToEvent(me, code);
      } else if (!admin) {
        const shared = await sharedMap(me);
        if (!shared[target]) return send(res, 403, { error: "You can connect with people from the events you attended." });
      }
      const [, back] = await pipeline([["SADD", `follows:${uid}`, target], ["SISMEMBER", `follows:${target}`, uid]]);
      await redis(["SADD", `followers:${target}`, uid]);
      return send(res, 200, { ok: true, mutual: Boolean(back) });
    }

    // ----- host only -----
    if (a === "events" && req.method === "GET") {
      if (!admin) return send(res, 403, { error: "Only the host can see this." });
      const codes = await redis(["SMEMBERS", "events"]);
      const evs = await getEvents(codes);
      const counts = await pipeline(codes.map((c) => ["SCARD", `evm:${c}`]));
      const list = codes.map((c, i) => Object.assign({ code: c, count: counts[i] }, evs[c] || {}))
        .sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")));
      return send(res, 200, { events: list });
    }

    if (a === "resetlink" && isPost) {
      if (!admin) return send(res, 403, { error: "Only the host can make reset links." });
      const target = await getUser(str(body.id, 20));
      if (!target || !target.le) return send(res, 404, { error: "That member wasn't found." });
      const tok = rid(32);
      await redis(["SET", `reset:${tok}`, JSON.stringify({ id: target.id, exp: Date.now() + 24 * 3600 * 1000 }), "EX", 86400]);
      return send(res, 200, { token: tok });
    }

    if (a === "news-add" && isPost) {
      if (!admin) return send(res, 403, { error: "Only the host can post stories." });
      const title = str(body.title, 160);
      if (!title) return send(res, 400, { error: "Give the story a headline." });
      const date = /^\d{4}-\d{2}-\d{2}$/.test(str(body.date, 10)) ? str(body.date, 10) : new Date().toISOString().slice(0, 10);
      const area = NEWS_AREAS.indexOf(body.area) > -1 ? body.area : "Credit";
      const url = str(body.srcUrl, 500);
      if (url && !/^https?:\/\//i.test(url)) return send(res, 400, { error: "The source link should start with https://" });
      const item = {
        id: date + "-" + rid(5), date, area, title,
        short: str(body.short, 240), what: str(body.what, 1500), take: str(body.take, 500),
        why: String(body.why || "").split(/\n+/).map((x) => x.trim().replace(/^[-•*]\s*/, "").slice(0, 400)).filter(Boolean).slice(0, 4),
        src: url ? [{ n: str(body.srcName, 80) || url.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0], u: url }] : [],
        posted: Date.now(),
      };
      const raw = await redis(["GET", "news"]);
      const list = [item].concat(raw ? JSON.parse(raw) : []).slice(0, 200);
      await redis(["SET", "news", JSON.stringify(list)]);
      return send(res, 200, { item });
    }

    if (a === "news-del" && isPost) {
      if (!admin) return send(res, 403, { error: "Only the host can remove stories." });
      const raw = await redis(["GET", "news"]);
      const list = (raw ? JSON.parse(raw) : []).filter((x) => x.id !== str(body.id, 40));
      await redis(["SET", "news", JSON.stringify(list)]);
      return send(res, 200, { ok: true });
    }

    if (a === "export" && req.method === "GET") {
      if (!admin) return send(res, 403, { error: "Only the host can see this." });
      const ids = await redis(["SMEMBERS", "members"]);
      const raws = ids.length ? await redis(["MGET", ...ids.map((x) => `user:${x}`)]) : [];
      const users = raws.filter(Boolean).map((r) => JSON.parse(r));
      const counts = users.length ? await pipeline(users.flatMap((u) => [["SCARD", `follows:${u.id}`], ["SCARD", `followers:${u.id}`]])) : [];
      const evs = await getEvents(await redis(["SMEMBERS", "events"]));
      const rows = users.map((u, i) => ({
        id: u.id, n: u.n, le: u.le, r: u.r, v: u.v, o: u.o, mb: u.mb, hm: u.hm, lg: u.lg, ask: u.ask, s: u.s || {},
        events: (u.ev || []).map((c) => (evs[c] ? evs[c].name + (evs[c].date ? " (" + evs[c].date + ")" : "") : c)),
        following: counts[i * 2] || 0, followers: counts[i * 2 + 1] || 0, created: u.created, updated: u.updated,
      })).sort((x, y) => (y.created || 0) - (x.created || 0));
      return send(res, 200, { members: rows });
    }

    if (a === "event" && isPost) {
      if (!admin) return send(res, 403, { error: "Only the host can create events." });
      const name = str(body.name, 80), date = str(body.date, 10);
      if (!name) return send(res, 400, { error: "Give the event a name." });
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: "Use a real date." });
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-")[0].slice(0, 12) || "onlu";
      let code = slug + "-" + rid(4);
      while (await redis(["EXISTS", `event:${code}`])) code = slug + "-" + rid(4);
      await pipeline([
        ["SET", `event:${code}`, JSON.stringify({ code, name, date, created: Date.now() })],
        ["SADD", "events", code],
      ]);
      await addToEvent(me, code);   // the host attends every event they create
      return send(res, 200, { code });
    }

    return send(res, 404, { error: "Unknown action" });
  } catch (err) {
    console.error("members api", err);
    return send(res, 502, { error: "Something went wrong on our side. Try again in a moment." });
  }
};
