/* ============================================================
   Coffee with Onlu — waitlist API (Vercel serverless function)

   Receives a signup from the site, validates it, and forwards it to
   a Google Apps Script web app that appends a row to your Sheet.
   type: "waitlist" (default) | "rsvp" | "subscribe" (email list for
   news and/or events; name optional, topics = "News, Events").

   Required environment variables (set in the Vercel dashboard):
     SHEETS_WEBHOOK_URL  – the Apps Script web-app URL (see sheets-endpoint.gs)
     SHEETS_TOKEN        – (optional) shared secret; must match the
                           WAITLIST_TOKEN script property in Apps Script
   ============================================================ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const store = require("./_redis");

// GET /api/waitlist?check=1 — is the Sheet hooked up? (no secrets shown)
async function check(res) {
  const out = { webhookSet: !!process.env.SHEETS_WEBHOOK_URL, tokenSet: !!process.env.SHEETS_TOKEN, backupStorage: store.configured };
  if (out.webhookSet) {
    try {
      const r = await fetch(process.env.SHEETS_WEBHOOK_URL, { redirect: "follow" });
      const text = await r.text();
      out.scriptStatus = r.status;
      out.scriptReply = /^\s*\{/.test(text) ? JSON.parse(text) : "not JSON (" + text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) + ")";
    } catch (e) { out.scriptReply = "could not reach it: " + e.message; }
  }
  if (store.configured) {
    try {
      const [n, last] = await store.pipeline([["SCARD", "subs"], ["GET", "sheet:last"]]);
      out.subscribersSaved = n;
      out.lastSheetPost = last ? JSON.parse(last) : null;   // what the Sheet said to the most recent signup
    } catch (e) { out.subscribersSaved = "error"; }
  }
  return res.status(200).json(out);
}

// remember how the Sheet answered the last signup (shown by ?check=1)
async function noteSheet(type, ok, detail) {
  if (!store.configured) return;
  try { await store.redis(["SET", "sheet:last", JSON.stringify({ at: new Date().toISOString(), type, ok, detail: detail || "" })]); } catch (e) {}
}

// keep a copy of every subscriber in Upstash, so the list survives a Sheet problem
async function saveSubscriber(x) {
  if (!store.configured) return false;
  try {
    const key = "sub:" + x.email.toLowerCase();
    const old = await store.redis(["GET", key]);
    const prev = old ? JSON.parse(old) : {};
    await store.pipeline([
      ["SET", key, JSON.stringify({ email: x.email, name: x.name || prev.name || "", topics: x.topics, page: x.page || prev.page || "",
        first: prev.first || Date.now(), updated: Date.now() })],
      ["SADD", "subs", x.email.toLowerCase()],
    ]);
    return true;
  } catch (e) { console.error("subscriber backup failed", e); return false; }
}

module.exports = async (req, res) => {
  if (req.method === "GET" && /[?&]check=1/.test(req.url || "")) return check(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Vercel parses JSON bodies automatically; guard anyway.
  const body = typeof req.body === "object" && req.body ? req.body : {};

  // Honeypot: the hidden "company" field is invisible to humans. If it's
  // filled, it's a bot — pretend success so it doesn't retry, but drop it.
  if (body.company) {
    return res.status(200).json({ ok: true });
  }

  const type = String(body.type || "waitlist").trim();
  const event = String(body.event || "").trim();
  const eventTab = String(body.eventTab || "").trim();
  const name = String(body.name || "").trim();
  const vertical = String(body.vertical || "").trim();
  const role = String(body.role || "").trim();
  const availableDate = String(body.availableDate || "").trim();
  const goals = String(body.goals || "").trim();
  const email = String(body.email || "").trim();
  const linkedin = String(body.linkedin || "").trim();
  const instagram = String(body.instagram || "").trim();
  const wechat = String(body.wechat || "").trim();
  const mbti = String(body.mbti || "").trim();
  const topics = String(body.topics || "").trim();
  const notes = String(body.notes || "").trim();

  // Name and a valid email are always required. The detailed waitlist form
  // additionally requires vertical, role, and availability (enforced client-
  // side); RSVPs carry those from the featured event.
  if (!name && type !== "subscribe") {
    return res.status(400).json({ error: "Name is required" });
  }
  if (type === "subscribe" && !topics) {
    return res.status(400).json({ error: "Pick news, events or both" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  if (type === "waitlist" && (!vertical || !role || !availableDate)) {
    return res.status(400).json({ error: "Missing vertical, role, or availability" });
  }

  const saved = type === "subscribe" ? await saveSubscriber({ email, name, topics, page: notes.replace(/^Signed up on /, "") }) : false;

  const webhook = process.env.SHEETS_WEBHOOK_URL;
  if (!webhook) {
    console.error("SHEETS_WEBHOOK_URL is not set");
    await noteSheet(type, false, "SHEETS_WEBHOOK_URL is not set");
    if (saved) return res.status(200).json({ ok: true, sheet: false });
    return res.status(500).json({ error: "Server not configured", detail: "SHEETS_WEBHOOK_URL is not set" });
  }

  try {
    const resp = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: process.env.SHEETS_TOKEN || "",
        type,
        event,
        eventTab,
        name,
        vertical,
        role,
        availableDate,
        goals,
        email,
        linkedin,
        instagram,
        wechat,
        mbti,
        topics,
        notes,
        submittedAt: new Date().toISOString(),
        source: req.headers["referer"] || "",
      }),
    });

    // Apps Script always returns HTTP 200, so inspect the JSON body too.
    const text = await resp.text();
    let out = {};
    try { out = JSON.parse(text); } catch (_) { /* non-JSON = failure */ }

    if (!resp.ok || out.error || out.ok !== true) {
      console.error("Sheets webhook failed", resp.status, text.slice(0, 300));
      const detail = "sheet " + resp.status + ": " + (out.error || text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160));
      await noteSheet(type, false, detail);
      if (saved) return res.status(200).json({ ok: true, sheet: false });
      return res.status(502).json({ error: "Could not save signup", detail });
    }
    await noteSheet(type, true, out.updated ? "updated existing row" : "row added");

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Sheets webhook error", err);
    await noteSheet(type, false, "sheet unreachable: " + err.message);
    if (saved) return res.status(200).json({ ok: true, sheet: false });
    return res.status(502).json({ error: "Could not save signup", detail: "sheet unreachable: " + err.message });
  }
};
