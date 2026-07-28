# Coffee with Onlu ☕

Group networking for finance professionals — starting with New York City.
Small coffee tables seated by **vertical** (private equity & credit, investment
banking, quant, public equity & credit) and what people are hoping to get out of
the conversation.

An [Onlu Intel](https://onluintel.com) project, live at
**[coffeewithonlu.com](https://coffeewithonlu.com)**.

## What's here

This is the early-access **signup landing site**. Its job is to explain the
concept and capture interest — name, vertical, role, which dates work, email
(required; LinkedIn optional), and what each person is hoping to get out of it —
so we know which verticals to run first and can seat each coffee well.

The site itself is a static page (no build step); signups are handled by a
small Vercel serverless function that writes to a Google Sheet you own.

```
index.html          Landing page (hero, how-it-works, verticals, waitlist, FAQ)
styles.css          All styling (coffee-warm palette, fully responsive)
app.js              Vertical grid rendering + waitlist form handling
api/waitlist.js     Vercel serverless function — validates & forwards signups
sheets-endpoint.gs  Google Apps Script — appends each signup to your Sheet
.env.example        Template for the two environment variables Vercel needs
```

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy + wire up the waitlist (Vercel → Google Sheet)

The waitlist flow is:

```
browser → /api/waitlist (Vercel function) → Google Apps Script → your Sheet
```

Routing through the function means no CORS issues, server-side validation, a
spam honeypot, and your Google URL stays private. One-time setup:

### 1. Create the Google Sheet + endpoint

1. Make a Google Sheet. The script auto-creates tabs (with headers) as signups
   arrive: a **Waitlist** tab, plus **one tab per coffee** for its RSVPs
   (e.g. `Quant · Aug 1`) — so each event has its own roster. Every tab's
   header row is:
   `Timestamp | Name | Vertical | Role | Available | Goals | Email | LinkedIn | Source | Instagram | WeChat | Event | MBTI | Topics | Notes`
2. In the Sheet: **Extensions → Apps Script**. Paste all of
   [`sheets-endpoint.gs`](./sheets-endpoint.gs) and save.
3. *(Recommended)* Set a shared secret: **Project Settings → Script Properties**
   → add `WAITLIST_TOKEN` = a long random string.
4. **Deploy → New deployment → Web app**, *Execute as: Me*,
   *Who has access: Anyone*. Copy the **Web app URL**.

Full step-by-step is in the header comment of `sheets-endpoint.gs`.

### 2. Deploy to Vercel

1. Import this repo at [vercel.com/new](https://vercel.com/new). No build settings
   needed — Vercel serves the static files and turns `api/waitlist.js` into a
   function automatically.
2. In **Settings → Environment Variables**, add (see `.env.example`):
   - `SHEETS_WEBHOOK_URL` = the Web app URL from step 1.4
   - `SHEETS_TOKEN` = the same value as `WAITLIST_TOKEN` (or leave blank if you skipped it)
3. **Redeploy** so the env vars take effect, then point `coffeewithonlu.com`
   at the Vercel project.

That's it — submissions now land as rows in your Sheet.

### Test it

Submit the form on the live site (or `curl` it):

```bash
curl -X POST https://coffeewithonlu.com/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"type":"waitlist","name":"Test User","vertical":"Private Equity","role":"Associate","availableDate":"Thursdays","goals":"Meet buy-side peers","email":"test@example.com"}'
```

A new row should appear in your Sheet within a second or two.

## The verticals

The vertical taxonomy is the core of the product and lives in one place:
the `VERTICALS` array at the top of `app.js`, plus the `<select>` in
`index.html`. Add, remove, or reorder there — the grid reads from it directly.

## Roadmap (suggested)

1. **Signups** ← you are here — validate demand per vertical
2. Run weekly themed coffees (one vertical at a time), open RSVP
3. Add tables per vertical as volume grows; seat by role + stated goals
4. Optional LinkedIn verification as a "verified" signal, once it's worth something
5. Scheduling + café suggestions; light membership
6. Expand verticals, then cities and industries
