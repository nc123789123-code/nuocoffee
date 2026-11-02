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

## Onlu Card live updates (optional)

`/card` works with no backend: each card travels inside its QR link. To let a
saved QR always open the owner's latest card, switch on storage for
`api/card.js`:

1. Vercel → this project → **Storage** → **Create Database** → **Upstash for
   Redis** (free plan) → connect it to the project for all environments. This
   adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. **Redeploy**.
3. Open `/card` on your phone. Under the QR it should say *"Live: people who
   scanned you see your latest edits"*.

Without it, `/api/card` answers 503 and the card quietly uses the copy in its
link.

## Onlu Members (`/members`)

Accounts for people who've been to an Onlu event. Each event has its own code;
members see only the people who attended at least one of the same events, can
follow only them, and get each other's LinkedIn, Instagram, WeChat, email and
phone only when both follow each other. All of this is enforced in
`api/members.js`.

Uses the same Upstash database as live cards, plus one variable:

- `ONLU_ADMIN_EMAIL` – optional; host email(s), comma-separated, default `hello@onlu.ai`. Hosts sign up without a code,
  sees every member, and gets an **Events** tab to create events. Each new
  event gets a code (e.g. `credit-5xk8`) and a join link
  (`/members/?code=credit-5xk8`) to share with the people who came.

Members who come to another event add its code under "Went to another Onlu
event?" in the People tab.

At events, members swap QRs: **Show my QR** (People tab) opens a full-screen
QR, with "Save QR image" for Photos. It links to
`/members/?code=<event>#m=<member id>`. Scanning it shows that member's public
card (no socials); a signed-in scanner taps **Connect** to follow them, and a
new person joins with the code prefilled and is connected automatically. The
QR's event code adds the scanner to that event if they weren't in it. When both
people scan each other, they're connected and their socials unlock.

## Onlu Brief (news)

The homepage shows the three latest stories; `/news` lists them all with area
filters, each as What happened / Why it matters / Onlu take with sources.

- Built-in stories live in `news/items.json`. After editing it, run
  `node tools/build-news.js` to write them into `index.html` and
  `news/index.html` (so search engines see them without JS).
- The host can also post stories from the members area (Events tab → Post to
  Onlu Brief). Those are stored in Upstash and merged in when the pages load.
- **Market pulse** comes from `api/markets.js`: public FRED CSVs (no key) for
  CPI (index and YoY from CPIAUCNS, MoM from CPIAUCSL, as BLS reports them),
  the Fed funds target range, 2/10/30-year Treasuries, 2s10s, the ICE BofA
  high-yield spread, unemployment, Brent and the S&P 500. Cached 6 hours.
- **Today in Finance** (live headlines) comes from `api/headlines.js`: Google
  News RSS searches by topic, major outlets first, cached by Vercel's CDN for
  30 minutes. No key needed; if the feeds fail the pages show a short note.

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
