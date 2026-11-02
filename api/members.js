/* ============================================================
   Onlu Members — accounts, profiles and follows (Vercel function)

   Everything is one endpoint, chosen with ?a=:
     POST signup  { code, name, email, password }
     POST login   { email, password }
     POST logout
     GET  me                       → my profile + who I follow / who follows me
     POST profile { …fields }      → update my profile
     GET  people                   → the directory (members only)
     POST follow  { id }   POST unfollow { id }

   Privacy rule, enforced here and nowhere else: a member's socials
   (LinkedIn, Instagram, WeChat, email, phone) are returned only to
   people they follow who also follow them back.

   Needs the Upstash Redis connection (see README) and one more variable:
     ONLU_INVITE_CODE – the code you hand out at Onlu events; sign-up is
                        closed until it is set.
   Optional: SESSION_SECRET (defaults to a key derived from the Redis token).
   ============================================================ */

const crypto = require("crypto");
const { redis, pipeline, configured, token } = require("./_redis");

const INVITE = String(process.env.ONLU_INVITE_CODE || "").trim().toLowerCase();
const SECRET = process.env.SESSION_SECRET || crypto.createHash("sha256").update("onlu-session:" + (token || "")).digest("hex");
const COOKIE = "onlu_s";
const MONTH = 60 * 60 * 24 * 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PUBLIC = ["n", "r", "o", "v", "mb", "hm", "lg", "ask"];
const PRIVATE = ["li", "ig", "wc", "em", "ph"];
const VERTICALS = ["Credit", "Quant & trading", "PE & real assets", "Investment banking", "Research & strategy", "AI & tech", "Healthcare", "Other"];

// ---------- helpers ----------
const send = (res, code, obj) => res.status(code).json(obj);
const rid = (n) => crypto.randomBytes(n).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, n).toLowerCase();
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function hashPw(pw, salt) {
  return crypto.scryptSync(pw, salt, 32).toString("hex");
}

function sign(uid) {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + MONTH * 1000 })).toString("base64url");
  const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return body + "." + mac;
}
function verify(tok) {
  if (!tok || tok.indexOf(".") < 0) return null;
  const [body, mac] = tok.split(".");
  const want = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
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
  if (!str(out.n, 80)) out.n = prev.n;
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
      if (!INVITE) return send(res, 503, { error: "Sign-up opens once the event invite code is set." });
      if (str(body.code, 60).toLowerCase() !== INVITE) return send(res, 403, { error: "That invite code isn't right. Ask Karlie for the code from your Onlu event." });
      const email = str(body.email, 120).toLowerCase(), pw = String(body.password || ""), name = str(body.name, 80);
      if (!name) return send(res, 400, { error: "Add your name." });
      if (!EMAIL_RE.test(email)) return send(res, 400, { error: "Enter a valid email." });
      if (pw.length < 8) return send(res, 400, { error: "Use a password of at least 8 characters." });
      if (await redis(["GET", `login:${email}`])) return send(res, 409, { error: "There's already an account with this email. Sign in instead." });
      const id = rid(12), salt = rid(16);
      const user = cleanProfile({ n: name }, { id, n: name, s: { em: email }, created: Date.now() });
      await pipeline([
        ["SET", `login:${email}`, JSON.stringify({ id, salt, hash: hashPw(pw, salt) })],
        ["SET", `user:${id}`, JSON.stringify(user)],
        ["SADD", "members", id],
      ]);
      setSession(res, id);
      return send(res, 200, { ok: true });
    }

    if (a === "login" && isPost) {
      const email = str(body.email, 120).toLowerCase(), pw = String(body.password || "");
      const [tries] = await pipeline([["INCR", `rl:${email}`], ["EXPIRE", `rl:${email}`, 900]]);
      if (tries > 10) return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
      const raw = await redis(["GET", `login:${email}`]);
      const rec = raw ? JSON.parse(raw) : null;
      const got = Buffer.from(hashPw(pw, rec ? rec.salt : "x"), "hex");
      const want = Buffer.from(rec ? rec.hash : "0".repeat(64), "hex");
      if (!rec || !crypto.timingSafeEqual(got, want)) return send(res, 401, { error: "Email or password doesn't match." });
      await redis(["DEL", `rl:${email}`]);
      setSession(res, rec.id);
      return send(res, 200, { ok: true });
    }

    if (a === "logout" && isPost) { setSession(res, ""); return send(res, 200, { ok: true }); }

    // ----- signed-in actions -----
    const uid = verify(readCookie(req));
    const me = uid ? await getUser(uid) : null;
    if (!me) return send(res, 401, { error: "Please sign in." });

    if (a === "me" && req.method === "GET") {
      const [following, followers] = await pipeline([["SMEMBERS", `follows:${uid}`], ["SMEMBERS", `followers:${uid}`]]);
      return send(res, 200, { me, following, followers, verticals: VERTICALS });
    }

    if (a === "profile" && isPost) {
      const next = cleanProfile(body, me);
      await redis(["SET", `user:${uid}`, JSON.stringify(next)]);
      return send(res, 200, { me: next });
    }

    if (a === "people" && req.method === "GET") {
      const [ids, following, followers] = await pipeline([["SMEMBERS", "members"], ["SMEMBERS", `follows:${uid}`], ["SMEMBERS", `followers:${uid}`]]);
      const others = ids.filter((x) => x !== uid);
      const raws = others.length ? await redis(["MGET", ...others.map((x) => `user:${x}`)]) : [];
      const iFollow = new Set(following), followsMe = new Set(followers);
      const people = raws.filter(Boolean).map((raw) => {
        const u = JSON.parse(raw), p = publicView(u);
        p.iFollow = iFollow.has(u.id);
        p.followsMe = followsMe.has(u.id);
        if (p.iFollow && p.followsMe) p.s = u.s || {};   // mutual only
        p.updated = u.updated;
        return p;
      }).sort((x, y) => (y.updated || 0) - (x.updated || 0));
      return send(res, 200, { people });
    }

    if ((a === "follow" || a === "unfollow") && isPost) {
      const target = str(body.id, 20);
      if (!target || target === uid || !(await redis(["EXISTS", `user:${target}`]))) return send(res, 400, { error: "That member wasn't found." });
      const op = a === "follow" ? "SADD" : "SREM";
      await pipeline([[op, `follows:${uid}`, target], [op, `followers:${target}`, uid]]);
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: "Unknown action" });
  } catch (err) {
    console.error("members api", err);
    return send(res, 502, { error: "Something went wrong on our side. Try again in a moment." });
  }
};
