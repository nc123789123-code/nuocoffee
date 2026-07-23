# Coffee with Onlu ☕

Group networking for finance professionals — starting with New York City.
Small, curated groups matched by **vertical** (quant, investment banking,
private equity, private credit, public equity, public credit, and more) and
seniority, meeting over coffee.

An [Onlu Intel](https://onluintel.com) project, live at
**[coffeewithonlu.com](https://coffeewithonlu.com)**.

## What's here

This is the early-access **waitlist landing site** — the first step before
building the matching engine. Its job is to explain the concept and capture
demand *by vertical, seniority, and neighborhood* so we know which NYC cohorts
to launch first.

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

1. Make a Google Sheet. In row 1, add headers:
   `Timestamp | Name | Email | Vertical | Seniority | Neighborhood | Source`
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
  -d '{"name":"Test User","email":"test@firm.com","vertical":"Private Equity","seniority":"Associate","neighborhood":"Midtown"}'
```

A new row should appear in your Sheet within a second or two.

## The verticals

The vertical taxonomy is the core of the product and lives in one place:
the `VERTICALS` array at the top of `app.js`, plus the `<select>` in
`index.html`. Add, remove, or reorder there — the grid reads from it directly.

## Roadmap (suggested)

1. **Waitlist** ← you are here — validate demand per vertical
2. Work-email verification + seniority tiers
3. Group formation (4–6 peers, matched by vertical + level + neighborhood)
4. Scheduling + café suggestions
5. Membership / billing
6. Expand verticals, then cities and industries
