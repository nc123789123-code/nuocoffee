/* ============================================================
   Market pulse — CPI and market data (Vercel serverless function)

   GET /api/markets → { updated, cpi, fed, tiles: [...] }

   Reads public FRED series (Federal Reserve Bank of St. Louis) as CSV,
   which needs no API key. Vercel's CDN caches the answer for 6 hours.
   Any series that fails is simply left out.

   CPI follows BLS headline conventions: the index level and year-over-year
   change use the not-seasonally-adjusted series (CPIAUCNS); month-over-month
   uses the seasonally adjusted one (CPIAUCSL).
   ============================================================ */

const BASE = process.env.FRED_CSV_BASE || "https://fred.stlouisfed.org/graph/fredgraph.csv";
const DAY = 864e5;

function ymd(t) { return new Date(t).toISOString().slice(0, 10); }

async function series(id, daysBack) {
  const url = BASE + "?id=" + encodeURIComponent(id) + "&cosd=" + ymd(Date.now() - daysBack * DAY);
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; OnluBrief/1.0)" } });
    if (!r.ok) return [];
    return (await r.text()).trim().split(/\r?\n/).slice(1).map((line) => {
      const [d, v] = line.split(",");
      return { d: d && d.trim(), v: parseFloat(v) };
    }).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.d) && isFinite(x.v));
  } catch (e) { return []; } finally { clearTimeout(timer); }
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
  const keys = Object.keys(ids);
  const got = await Promise.all(keys.map((k) => series(k, ids[k])));
  const S = Object.fromEntries(keys.map((k, i) => [k, got[i]]));

  const out = { updated: new Date().toISOString(), cpi: cpiBlock(S.CPIAUCNS, S.CPIAUCSL), fed: null, tiles: [],
    missing: keys.filter((k) => !S[k].length) };   // series FRED didn't return (helps diagnose)

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
