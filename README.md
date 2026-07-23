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

It's a fully self-contained static site — no build step, no dependencies.

```
index.html    Landing page (hero, how-it-works, verticals, waitlist, FAQ)
styles.css    All styling (coffee-warm palette, fully responsive)
app.js        Vertical grid rendering + waitlist form handling
```

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy

Any static host works — GitHub Pages, Vercel, Netlify, Cloudflare Pages.
Point them at the repo root; there's nothing to build.

## Wiring up the waitlist

Signups are currently stored in the browser (`localStorage`) and confirmed
client-side — enough to demo, but they don't reach you yet. To collect real
signups, replace the body of `submitSignup()` in `app.js` with a POST to a
backend. The easiest options:

- **[Formspree](https://formspree.io)** — paste your form ID, no server needed
- A serverless function (Vercel / Cloudflare) writing to Airtable, Sheets, or a DB

A ready-to-uncomment `fetch()` example is included in `app.js`.

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
