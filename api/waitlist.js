/* ============================================================
   Coffee with Onlu — waitlist API (Vercel serverless function)

   Receives a signup from the site, validates it, and forwards it to
   a Google Apps Script web app that appends a row to your Sheet.

   Required environment variables (set in the Vercel dashboard):
     SHEETS_WEBHOOK_URL  – the Apps Script web-app URL (see sheets-endpoint.gs)
     SHEETS_TOKEN        – (optional) shared secret; must match the
                           WAITLIST_TOKEN script property in Apps Script
   ============================================================ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
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

  // Name and a valid email are always required. The detailed waitlist form
  // additionally requires vertical, role, and availability (enforced client-
  // side); RSVPs carry those from the featured event.
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  if (type === "waitlist" && (!vertical || !role || !availableDate)) {
    return res.status(400).json({ error: "Missing vertical, role, or availability" });
  }

  const webhook = process.env.SHEETS_WEBHOOK_URL;
  if (!webhook) {
    console.error("SHEETS_WEBHOOK_URL is not set");
    return res.status(500).json({ error: "Server not configured" });
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
      return res.status(502).json({ error: "Could not save signup" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Sheets webhook error", err);
    return res.status(502).json({ error: "Could not save signup" });
  }
};
