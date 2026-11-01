/* ============================================================
   Onlu Card — live cards API (Vercel serverless function)

   Lets a saved QR always open the owner's latest card.
     GET  /api/card?id=<id>          → { card, updated }
     POST /api/card { id, key, card } → { ok, updated }
   The first POST for an id claims it; later updates must send the same
   key (only its SHA-256 is stored). Cards hold contact details only —
   no photos — and are capped in size.

   Storage: Upstash Redis over its REST API (free tier is plenty).
   In Vercel → Storage → create an Upstash Redis database and connect it
   to this project; that adds KV_REST_API_URL and KV_REST_API_TOKEN.
   Without them this returns 503 and the card falls back to the copy
   inside its link, exactly as before.
   ============================================================ */

const crypto = require("crypto");

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const ID_RE = /^[a-z0-9]{8,16}$/;
const TEXT_FIELDS = ["n", "r", "o", "li", "ig", "wc", "em", "ph", "ag", "ev", "avu", "mb", "zd", "hm", "lg", "ask"];
const WELL_FIELDS = ["src", "sl", "rd", "st", "ch", "act"];

function clean(card) {
  if (!card || typeof card !== "object") return null;
  const out = {};
  for (const k of TEXT_FIELDS) {
    if (typeof card[k] === "string" && card[k].trim()) out[k] = card[k].trim().slice(0, 300);
  }
  if (card.av && typeof card.av.e === "string" && card.av.e) {
    out.av = { e: card.av.e.slice(0, 8), c: Math.max(0, Math.min(4, card.av.c | 0)) };
  }
  if (card.w && typeof card.w === "object") {
    const w = {};
    for (const k of WELL_FIELDS) {
      if (typeof card.w[k] === "string" && card.w[k].trim()) w[k] = card.w[k].trim().slice(0, 60);
    }
    if (Object.keys(w).length) out.w = w;
  }
  return out.n ? out : null;
}

async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({ error: "Live cards are not set up" });
  }

  try {
    if (req.method === "GET") {
      const id = String((req.query && req.query.id) || "");
      if (!ID_RE.test(id)) return res.status(400).json({ error: "Bad id" });
      const raw = await redis(["GET", `card:${id}`]);
      if (!raw) return res.status(404).json({ error: "Not found" });
      const { card, updated } = JSON.parse(raw);
      return res.status(200).json({ card, updated });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "object" && req.body ? req.body : {};
      const id = String(body.id || "");
      const key = String(body.key || "");
      if (!ID_RE.test(id) || key.length < 20 || key.length > 80) {
        return res.status(400).json({ error: "Bad id or key" });
      }
      const card = clean(body.card);
      if (!card) return res.status(400).json({ error: "A card needs a name" });
      const value = JSON.stringify({ card, keyHash: sha(key), updated: Date.now() });
      if (value.length > 6000) return res.status(413).json({ error: "Card is too large" });

      const raw = await redis(["GET", `card:${id}`]);
      if (raw && JSON.parse(raw).keyHash !== sha(key)) {
        return res.status(403).json({ error: "This card belongs to another phone" });
      }
      await redis(["SET", `card:${id}`, value]);
      return res.status(200).json({ ok: true, updated: JSON.parse(value).updated });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("card api", err);
    return res.status(502).json({ error: "Storage is unavailable" });
  }
};
