/* ============================================================
   Market pulse — CPI and market data (Vercel serverless function)

   GET /api/markets → { updated, cpi, fed, tiles: [...] }

   Reads public FRED series (Federal Reserve Bank of St. Louis) as CSV,
   which needs no API key, with keyless backups for when FRED refuses:
   BLS (CPI, unemployment), Treasury.gov (yields), the New York Fed (Fed
   funds range) and Stooq (S&P 500, Brent). Vercel's CDN caches the answer
   for 6 hours. Any series that still fails is left out.

   CPI follows BLS headline conventions: the index level and year-over-year
   change use the not-seasonally-adjusted series (CPIAUCNS); month-over-month
   uses the seasonally adjusted one (CPIAUCSL).
   ============================================================ */

const BASE = process.env.FRED_CSV_BASE || "https://fred.stlouisfed.org/graph/fredgraph.csv";
// Backups, used for any series FRED doesn't return (FRED can refuse cloud servers).
const BLS = process.env.BLS_API_BASE || "https://api.bls.gov/publicAPI/v1/timeseries/data/";
const TREASURY = process.env.TREASURY_CSV_BASE || "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv";
const NYFED = process.env.NYFED_API_BASE || "https://markets.newyorkfed.org/api/rates/unsecured/effr/last/60.json";
const STOOQ = process.env.STOOQ_CSV_BASE || "https://stooq.com/q/d/l/";
const DAY = 864e5;
const UA = { "User-Agent": "Mozilla/5.0 (compatible; OnluBrief/1.0; +https://coffeewithonlu.com)" };

function ymd(t) { return new Date(t).toISOString().slice(0, 10); }

// fetch with a timeout; records "name:status" in errs on failure
async function get(url, errs, name, opts) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl.signal, headers: UA }, opts || {}));
    if (!r.ok) { errs.push(name + ":" + r.status); return null; }
    return await r.text();
  } catch (e) { errs.push(name + ":" + (e.name === "AbortError" ? "timeout" : "error")); return null; }
  finally { clearTimeout(timer); }
}
const ok = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x.d) && isFinite(x.v);
const asc = (rows) => rows.filter(ok).sort((a, b) => a.d.localeCompare(b.d));

async function series(id, daysBack, errs) {
  const text = await get(BASE + "?id=" + encodeURIComponent(id) + "&cosd=" + ymd(Date.now() - daysBack * DAY), errs, "FRED " + id);
  if (!text || !/^[a-z_]+,/i.test(text)) { if (text) errs.push("FRED " + id + ":not csv"); return []; }
  return asc(text.trim().split(/\r?\n/).slice(1).map((line) => { const [d, v] = line.split(","); return { d: d && d.trim(), v: parseFloat(v) }; }));
}

// BLS v1 (no key): CPI NSA, CPI SA, unemployment
async function fromBLS(errs) {
  const y = new Date().getUTCFullYear();
  const text = await get(BLS, errs, "BLS", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, UA),
    body: JSON.stringify({ seriesid: ["CUUR0000SA0", "CUSR0000SA0", "LNS14000000"], startyear: String(y - 2), endyear: String(y) }) });
  const out = {};
  try {
    const j = JSON.parse(text || "{}");
    if (j.status !== "REQUEST_SUCCEEDED") { if (text) errs.push("BLS:" + (j.status || "bad")); return out; }
    const map = { CUUR0000SA0: "CPIAUCNS", CUSR0000SA0: "CPIAUCSL", LNS14000000: "UNRATE" };
    for (const s of j.Results.series || []) {
      out[map[s.seriesID]] = asc((s.data || []).filter((x) => /^M(0[1-9]|1[0-2])$/.test(x.period))
        .map((x) => ({ d: x.year + "-" + x.period.slice(1) + "-01", v: parseFloat(x.value) })));
    }
  } catch (e) { errs.push("BLS:parse"); }
  return out;
}

// Treasury daily par yield curve (CSV per year)
async function fromTreasury(errs) {
  const now = new Date(), years = [now.getUTCFullYear()];
  if (now.getUTCMonth() < 2) years.push(now.getUTCFullYear() - 1);
  const rows = [];
  for (const y of years) {
    const text = await get(TREASURY + "/" + y + "/all?type=daily_treasury_yield_curve&field_tdr_date_value=" + y + "&page&_format=csv", errs, "Treasury " + y);
    if (!text) continue;
    const lines = text.trim().split(/\r?\n/);
    const head = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    const i2 = head.indexOf("2 Yr"), i10 = head.indexOf("10 Yr"), i30 = head.indexOf("30 Yr");
    if (i2 < 0 || i10 < 0) { errs.push("Treasury:columns"); continue; }
    for (const line of lines.slice(1)) {
      const c = line.split(","), m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((c[0] || "").replace(/"/g, ""));
      if (m) rows.push({ d: m[3] + "-" + m[1] + "-" + m[2], y2: parseFloat(c[i2]), y10: parseFloat(c[i10]), y30: parseFloat(c[i30]) });
    }
  }
  const pick = (k) => asc(rows.map((r) => ({ d: r.d, v: r[k] })));
  return { DGS2: pick("y2"), DGS10: pick("y10"), DGS30: pick("y30"),
           T10Y2Y: asc(rows.map((r) => ({ d: r.d, v: Math.round((r.y10 - r.y2) * 100) / 100 }))) };
}

// New York Fed: effective fed funds rate carries the target range
async function fromNYFed(errs) {
  const text = await get(NYFED, errs, "NYFed");
  try {
    const rates = (JSON.parse(text || "{}").refRates || []).filter((r) => r.targetRateTo != null);
    return { DFEDTARU: asc(rates.map((r) => ({ d: r.effectiveDate, v: +r.targetRateTo }))),
             DFEDTARL: asc(rates.map((r) => ({ d: r.effectiveDate, v: +r.targetRateFrom }))) };
  } catch (e) { errs.push("NYFed:parse"); return {}; }
}

// Stooq daily closes: S&P 500 and Brent
async function fromStooq(errs) {
  const d1 = ymd(Date.now() - 60 * DAY).replace(/-/g, ""), d2 = ymd(Date.now()).replace(/-/g, "");
  const one = async (sym, id) => {
    const text = await get(STOOQ + "?s=" + encodeURIComponent(sym) + "&d1=" + d1 + "&d2=" + d2 + "&i=d", errs, "Stooq " + sym);
    if (!text || !/^Date,/i.test(text)) { if (text) errs.push("Stooq " + sym + ":not csv"); return [id, []]; }
    const lines = text.trim().split(/\r?\n/), head = lines[0].split(","), ic = head.indexOf("Close");
    return [id, asc(lines.slice(1).map((l) => { const c = l.split(","); return { d: c[0], v: parseFloat(c[ic]) }; }))];
  };
  return Object.fromEntries(await Promise.all([one("^spx", "SP500"), one("cb.f", "DCOILBRENTEU")]));
}

const round = (x, n) => (x == null || !isFinite(x) ? null : Math.round(x * Math.pow(10, n)) / Math.pow(10, n));

// latest value, and the value about a month earlier (last observation on or before latest − 30 days)
function latestAndMonthAgo(rows) {
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  const cutoff = ymd(Date.parse(last.d) - 30 * DAY);
  let prev = null;
  for (const r of rows) if (r.d <= cutoff) prev = r;
  return { v: last.v, d: last.d, prev: prev ? prev.v : null, prevD: prev ? prev.d : null };
}

function cpiBlock(nsa, sa) {
  if (nsa.length < 13) return null;
  const byMonth = (rows) => Object.fromEntries(rows.map((r) => [r.d.slice(0, 7), r.v]));
  const n = byMonth(nsa), s = byMonth(sa);
  const months = Object.keys(n).sort();
  const yoyOf = (m) => {
    const [y, mo] = m.split("-").map(Number);
    const prior = (y - 1) + "-" + String(mo).padStart(2, "0");
    return n[prior] ? (n[m] / n[prior] - 1) * 100 : null;
  };
  const last = months[months.length - 1];
  const i = months.indexOf(last), prevM = months[i - 1];
  const mom = s[last] && s[prevM] ? (s[last] / s[prevM] - 1) * 100 : null;
  const history = months.slice(-12).map((m) => ({ m, yoy: round(yoyOf(m), 2) })).filter((x) => x.yoy != null);
  return { month: last, index: round(n[last], 1), yoy: round(yoyOf(last), 2), mom: round(mom, 2), target: 2, history };
}

module.exports = async (req, res) => {
  const ids = {
    CPIAUCNS: 800, CPIAUCSL: 800, DFEDTARU: 60, DFEDTARL: 60, DGS2: 60, DGS10: 60, DGS30: 60,
    T10Y2Y: 60, BAMLH0A0HYM2: 60, UNRATE: 120, DCOILBRENTEU: 60, SP500: 60,
  };
  const keys = Object.keys(ids), errs = [];
  // FRED and the backups run at the same time; FRED wins wherever it answered
  const [got, ...backups] = await Promise.all([
    Promise.all(keys.map((k) => series(k, ids[k], errs))), fromBLS(errs), fromTreasury(errs), fromNYFed(errs), fromStooq(errs)]);
  const S = {}, source = {};
  keys.forEach((k, i) => {
    if (got[i].length) { S[k] = got[i]; source[k] = "FRED"; return; }
    const alt = backups.find((b) => b && b[k] && b[k].length);
    S[k] = alt ? alt[k] : [];
    if (alt) source[k] = ["BLS", "Treasury", "NY Fed", "Stooq"][backups.indexOf(alt)];
  });

  const out = { updated: new Date().toISOString(), cpi: cpiBlock(S.CPIAUCNS, S.CPIAUCSL), fed: null, tiles: [],
    source, missing: keys.filter((k) => !S[k].length), errors: errs };   // to diagnose outages

  const up = latestAndMonthAgo(S.DFEDTARU), lo = latestAndMonthAgo(S.DFEDTARL);
  if (up && lo) out.fed = { lo: lo.v, hi: up.v, d: up.d };

  // [id, label, unit, how to show the change]
  const TILES = [
    ["DGS2", "2-year Treasury", "%", "bp"], ["DGS10", "10-year Treasury", "%", "bp"], ["DGS30", "30-year Treasury", "%", "bp"],
    ["T10Y2Y", "2s10s curve", "%", "bp"], ["BAMLH0A0HYM2", "High-yield spread", "%", "bp"],
    ["UNRATE", "Unemployment", "%", "pt"], ["DCOILBRENTEU", "Brent crude", "$", "pct"], ["SP500", "S&P 500", "", "pct"],
  ];
  for (const [id, label, unit, chg] of TILES) {
    const x = latestAndMonthAgo(S[id]);
    if (!x) continue;
    let change = null;
    if (x.prev != null) {
      if (chg === "bp") change = round((x.v - x.prev) * 100, 0);
      else if (chg === "pt") change = round(x.v - x.prev, 1);
      else change = round((x.v / x.prev - 1) * 100, 1);
    }
    // monthly series are dated the 1st of the month they describe
    out.tiles.push({ id, label, unit, v: round(x.v, unit === "$" ? 2 : unit === "" ? 0 : 2), d: x.d, change, chg, monthly: id === "UNRATE" });
  }

  const ok = out.cpi || out.fed || out.tiles.length;
  res.setHeader("Cache-Control", ok ? "public, s-maxage=21600, stale-while-revalidate=86400" : "no-store");
  res.status(200).json(out);
};
module.exports.cpiBlock = cpiBlock;
module.exports.latestAndMonthAgo = latestAndMonthAgo;
