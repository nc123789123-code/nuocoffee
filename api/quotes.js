/* ============================================================
   Markets now — index levels and today's change (Vercel serverless function)

   GET /api/quotes → { updated, open, items: [{ id, label, kind, v, prev, chg, pct, t, spark }] }
     v last price · prev previous close · chg change (bp for yields) · pct % change
     t time of the last price (ISO) · spark intraday prices for a small line

   Reads Yahoo Finance's public chart endpoint (intraday, no key). Anything
   Yahoo doesn't return (it often refuses cloud servers) comes from CNBC's
   public quote feed, then Finnhub ETF quotes (if FINNHUB_API_KEY is set),
   CoinGecko for bitcoin, then Stooq's daily CSV (last two closes).
   Vercel's CDN caches the answer for 60 seconds. Quotes can be delayed.
   ============================================================ */

const YAHOO = process.env.YAHOO_CHART_BASE || "https://query1.finance.yahoo.com/v8/finance/chart/";
const CNBC = process.env.CNBC_QUOTE_BASE || "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol";
const FINNHUB = process.env.FINNHUB_API_BASE || "https://finnhub.io/api/v1/quote";
const COINGECKO = process.env.COINGECKO_API_BASE || "https://api.coingecko.com/api/v3/simple/price";
const STOOQ = process.env.STOOQ_CSV_BASE || "https://stooq.com/q/d/l/";
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" };

// [id, label, Yahoo symbol, Stooq symbol, kind, CNBC symbol]  kind: index | yield | price
const LIST = [
  ["SPX", "S&P 500", "^GSPC", "^spx", "index", ".SPX"],
  ["NDX", "Nasdaq", "^IXIC", "^ndq", "index", ".IXIC"],
  ["DJI", "Dow", "^DJI", "^dji", "index", ".DJI"],
  ["RUT", "Russell 2000", "^RUT", "", "index", ".RUT"],
  ["VIX", "VIX", "^VIX", "", "index", ".VIX"],
  ["TNX", "10-year yield", "^TNX", "", "yield", "US10Y"],
  ["BRENT", "Brent", "BZ=F", "cb.f", "price", "@LCO.1"],
  ["GOLD", "Gold", "GC=F", "gc.f", "price", "@GC.1"],
  ["BTC", "Bitcoin", "BTC-USD", "btcusd", "price", "BTC.CM="],
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

// CNBC quote feed: one request for every symbol; numbers arrive as text like "6,812.40" or "4.155%"
const toNum = (x) => { const n = parseFloat(String(x == null ? "" : x).replace(/[,%+\s]/g, "")); return isFinite(n) ? n : NaN; };
function fromCnbcJson(text) {
  const j = JSON.parse(text);
  let list = j && j.FormattedQuoteResult && j.FormattedQuoteResult.FormattedQuote;
  if (list && !Array.isArray(list)) list = [list];
  const out = {};
  for (const q of list || []) {
    const row = LIST.find((l) => l[5] === q.symbol);
    if (!row) continue;
    const kind = row[4], v = toNum(q.last);
    let prev = toNum(q.previous_day_closing);
    if (!isFinite(prev) && isFinite(toNum(q.change))) prev = v - toNum(q.change);
    const x = finish(kind, v, prev);
    if (!x) continue;
    const t = Date.parse(q.last_time);
    x.t = isFinite(t) ? new Date(t).toISOString() : null; x.spark = [];
    out[row[0]] = x;
  }
  return out;
}
async function fromCnbc(errs) {
  const url = CNBC + "?symbols=" + encodeURIComponent(LIST.map((l) => l[5]).join("|")) +
    "&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1";
  const text = await get(url, errs, "CNBC");
  if (!text) return {};
  try { return fromCnbcJson(text); } catch (e) { errs.push("CNBC:parse"); return {}; }
}

// Finnhub (free key in FINNHUB_API_KEY): real-time ETF quotes standing in for each index.
// Shown with the ETF's ticker and price so nobody mistakes them for index levels.
const ETF = { SPX: "SPY", NDX: "QQQ", DJI: "DIA", RUT: "IWM", GOLD: "GLD", BRENT: "BNO" };
async function fromFinnhub(errs) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return {};
  const out = {};
  await Promise.all(Object.keys(ETF).map(async (id) => {
    const text = await get(FINNHUB + "?symbol=" + ETF[id] + "&token=" + encodeURIComponent(key), errs, "Finnhub " + ETF[id]);
    try {
      const j = JSON.parse(text || "{}");
      if (!(j.c > 0)) return;
      const x = finish("price", j.c, j.pc);
      if (!x) return;
      x.t = j.t ? new Date(j.t * 1000).toISOString() : null; x.spark = []; x.etf = ETF[id];
      out[id] = x;
    } catch (e) { errs.push("Finnhub " + ETF[id] + ":parse"); }
  }));
  return out;
}

// CoinGecko (no key): bitcoin price and 24-hour change
async function fromCoinGecko(errs) {
  const text = await get(COINGECKO + "?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true", errs, "CoinGecko");
  try {
    const b = JSON.parse(text || "{}").bitcoin;
    if (!b || !(b.usd > 0)) return null;
    const x = finish("price", b.usd, isFinite(b.usd_24h_change) ? b.usd / (1 + b.usd_24h_change / 100) : NaN);
    if (!x) return null;
    x.t = b.last_updated_at ? new Date(b.last_updated_at * 1000).toISOString() : null; x.spark = []; x.basis = "24h";
    return x;
  } catch (e) { errs.push("CoinGecko:parse"); return null; }
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

// weekday 9:30 AM–4:00 PM New York time (exchange holidays not handled)
function nyOpen() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  const m = (+p.hour % 24) * 60 + +p.minute;
  return !/Sat|Sun/.test(p.weekday) && m >= 570 && m < 960;
}

module.exports = async (req, res) => {
  const errs = [];
  const [yahoo, cnbc, fh, cg] = await Promise.all([Promise.all(LIST.map((l) => fromYahoo(l[2], l[4], errs))), fromCnbc(errs), fromFinnhub(errs), fromCoinGecko(errs)]);
  const source = {};
  const got = await Promise.all(LIST.map(async ([id, label, ysym, ssym, kind], i) => {
    let q = yahoo[i], src = "Yahoo";
    if (!q && cnbc[id]) { q = cnbc[id]; src = "CNBC"; }
    if (!q && fh[id]) { q = fh[id]; src = "Finnhub"; label = label + " (" + q.etf + ")"; kind = "price"; }
    if (!q && id === "BTC" && cg) { q = cg; src = "CoinGecko"; }
    if (!q) { q = await fromStooq(ssym, kind, errs); src = "Stooq"; }
    if (q) source[id] = src;
    return q ? Object.assign({ id, label, kind }, q) : null;
  }));
  const items = got.filter(Boolean);
  const spx = items.find((x) => x.id === "SPX" && x.session);
  const now = Date.now() / 1000;
  const out = {
    updated: new Date().toISOString(),
    open: spx ? now >= spx.session.start && now < spx.session.end : (source.SPX === "CNBC" || source.SPX === "Finnhub" ? nyOpen() : null),   // U.S. regular hours
    items: items.map((x) => { const y = Object.assign({}, x); delete y.session; return y; }),
    source,
    missing: LIST.map((l) => l[0]).filter((id) => !items.some((x) => x.id === id)),
    errors: errs,
  };
  res.setHeader("Cache-Control", items.length ? "public, s-maxage=60, stale-while-revalidate=300" : "no-store");
  res.status(200).json(out);
};
module.exports.fromYahooJson = fromYahooJson;
module.exports.fromCnbcJson = fromCnbcJson;
