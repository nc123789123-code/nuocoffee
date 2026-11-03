/* ============================================================
   Markets now — index levels and today's change (Vercel serverless function)

   GET /api/quotes → { updated, open, items: [{ id, label, kind, v, prev, chg, pct, t, spark }] }
     v last price · prev previous close · chg change (bp for yields) · pct % change
     t time of the last price (ISO) · spark intraday prices for a small line

   Reads Yahoo Finance's public chart endpoint (intraday, no key). Anything
   Yahoo doesn't return falls back to Stooq's daily CSV (last two closes).
   Vercel's CDN caches the answer for 60 seconds. Quotes can be delayed.
   ============================================================ */

const YAHOO = process.env.YAHOO_CHART_BASE || "https://query1.finance.yahoo.com/v8/finance/chart/";
const STOOQ = process.env.STOOQ_CSV_BASE || "https://stooq.com/q/d/l/";
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" };

// [id, label, Yahoo symbol, Stooq symbol, kind]  kind: index | yield | price
const LIST = [
  ["SPX", "S&P 500", "^GSPC", "^spx", "index"],
  ["NDX", "Nasdaq", "^IXIC", "^ndq", "index"],
  ["DJI", "Dow", "^DJI", "^dji", "index"],
  ["RUT", "Russell 2000", "^RUT", "", "index"],
  ["VIX", "VIX", "^VIX", "", "index"],
  ["TNX", "10-year yield", "^TNX", "", "yield"],
  ["BRENT", "Brent", "BZ=F", "cb.f", "price"],
  ["GOLD", "Gold", "GC=F", "gc.f", "price"],
  ["BTC", "Bitcoin", "BTC-USD", "btcusd", "price"],
];

async function get(url, errs, name) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: UA });
    if (!r.ok) { errs.push(name + ":" + r.status); return null; }
    return await r.text();
  } catch (e) { errs.push(name + ":" + (e.name === "AbortError" ? "timeout" : "error")); return null; }
  finally { clearTimeout(timer); }
}

const round = (x, n) => (x == null || !isFinite(x) ? null : Math.round(x * Math.pow(10, n)) / Math.pow(10, n));

function finish(kind, v, prev) {
  if (!isFinite(v)) return null;
  const out = { v: round(v, kind === "yield" ? 3 : 2), prev: isFinite(prev) ? round(prev, kind === "yield" ? 3 : 2) : null, chg: null, pct: null };
  if (out.prev) {
    out.chg = kind === "yield" ? round((v - prev) * 100, 1) : round(v - prev, 2);   // yields move in basis points
    out.pct = round((v / prev - 1) * 100, 2);
  }
  return out;
}

// Yahoo chart JSON: meta.regularMarketPrice, meta.chartPreviousClose, intraday closes
function fromYahooJson(text, kind) {
  const j = JSON.parse(text);
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res || !res.meta) return null;
  const m = res.meta;
  const closes = (((res.indicators || {}).quote || [])[0] || {}).close || [];
  const spark = closes.filter((x) => x != null && isFinite(x));
  const v = isFinite(m.regularMarketPrice) ? m.regularMarketPrice : spark[spark.length - 1];
  const prev = isFinite(m.chartPreviousClose) ? m.chartPreviousClose : m.previousClose;
  const out = finish(kind, v, prev);
  if (!out) return null;
  out.t = m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null;
  // keep the line light: at most ~80 points
  const step = Math.max(1, Math.ceil(spark.length / 80));
  out.spark = spark.filter((_, i) => i % step === 0 || i === spark.length - 1).map((x) => round(x, 2));
  const reg = m.currentTradingPeriod && m.currentTradingPeriod.regular;
  if (reg) out.session = { start: reg.start, end: reg.end };
  return out;
}

async function fromYahoo(sym, kind, errs) {
  const text = await get(YAHOO + encodeURIComponent(sym) + "?interval=5m&range=1d", errs, "Yahoo " + sym);
  if (!text) return null;
  try { return fromYahooJson(text, kind); } catch (e) { errs.push("Yahoo " + sym + ":parse"); return null; }
}

// Stooq daily CSV: last row vs the row before (the last row can be today's partial day)
async function fromStooq(sym, kind, errs) {
  if (!sym) return null;
  const d = new Date(), d1 = new Date(d.getTime() - 14 * 864e5);
  const f = (x) => x.toISOString().slice(0, 10).replace(/-/g, "");
  const text = await get(STOOQ + "?s=" + encodeURIComponent(sym) + "&d1=" + f(d1) + "&d2=" + f(d) + "&i=d", errs, "Stooq " + sym);
  if (!text || !/^Date,/i.test(text)) return null;
  const lines = text.trim().split(/\r?\n/), head = lines[0].split(","), ic = head.indexOf("Close");
  const rows = lines.slice(1).map((l) => l.split(",")).filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c[0]) && isFinite(parseFloat(c[ic])));
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1], before = rows[rows.length - 2];
  const out = finish(kind, parseFloat(last[ic]), parseFloat(before[ic]));
  if (!out) return null;
  out.t = last[0] + "T21:00:00Z"; out.spark = []; out.daily = true;
  return out;
}

module.exports = async (req, res) => {
  const errs = [];
  const got = await Promise.all(LIST.map(async ([id, label, ysym, ssym, kind]) => {
    const q = (await fromYahoo(ysym, kind, errs)) || (await fromStooq(ssym, kind, errs));
    return q ? Object.assign({ id, label, kind }, q) : null;
  }));
  const items = got.filter(Boolean);
  const spx = items.find((x) => x.id === "SPX" && x.session);
  const now = Date.now() / 1000;
  const out = {
    updated: new Date().toISOString(),
    open: spx ? now >= spx.session.start && now < spx.session.end : null,   // U.S. stock market regular hours
    items: items.map((x) => { const y = Object.assign({}, x); delete y.session; return y; }),
    missing: LIST.map((l) => l[0]).filter((id) => !items.some((x) => x.id === id)),
    errors: errs,
  };
  res.setHeader("Cache-Control", items.length ? "public, s-maxage=60, stale-while-revalidate=300" : "no-store");
  res.status(200).json(out);
};
module.exports.fromYahooJson = fromYahooJson;
