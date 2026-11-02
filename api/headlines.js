/* ============================================================
   Today in Finance — live headlines (Vercel serverless function)

   GET /api/headlines → { updated, items: [{ t, u, s, c, d }] }
     t title · u link · s source · c category · d published (ISO)

   Pulls Google News RSS searches by topic, keeps major financial outlets
   first, removes duplicates, and lets Vercel's CDN cache the result for
   30 minutes. No key needed. If every feed fails, it returns an empty list
   and the pages show a short "unavailable" note.
   ============================================================ */

const BASE = process.env.HEADLINES_RSS_BASE || "https://news.google.com/rss/search";

const TOPICS = [
  { c: "Markets", q: "stock market OR \"markets wrap\" OR Wall Street" },
  { c: "Economy", q: "Federal Reserve OR inflation OR \"jobs report\" OR Treasury yields" },
  { c: "Credit", q: "\"private credit\" OR \"leveraged loans\" OR \"high yield bonds\" OR \"direct lending\"" },
  { c: "Banking", q: "banks OR \"investment banking\" OR \"bank regulation\"" },
  { c: "AI", q: "\"AI financing\" OR \"data center\" financing OR \"AI startup\" funding" },
  { c: "Policy", q: "SEC OR Congress OR tariffs finance" },
  { c: "Global", q: "ECB OR \"China economy\" OR \"Bank of Japan\" OR \"global markets\"" },
];

// shown first, in roughly this order of preference
const PREFERRED = ["Bloomberg", "Reuters", "Financial Times", "The Wall Street Journal", "WSJ", "CNBC", "Barron's",
  "MarketWatch", "Axios", "The New York Times", "Associated Press", "AP News", "Fortune", "Business Insider",
  "The Economist", "Yahoo Finance", "Forbes", "PitchBook", "Institutional Investor", "Semafor"];

function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}
function tag(chunk, name) {
  const m = chunk.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return m ? decode(m[1]) : "";
}

function parse(xml, category) {
  return String(xml).split(/<item[\s>]/i).slice(1).map((chunk) => {
    const source = tag(chunk, "source");
    let title = tag(chunk, "title");
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3)).trim();
    const date = new Date(tag(chunk, "pubDate"));
    return { t: title, u: tag(chunk, "link"), s: source, c: category, d: isNaN(date) ? "" : date.toISOString() };
  }).filter((x) => x.t && /^https?:\/\//.test(x.u));
}

const rank = (s) => { const i = PREFERRED.findIndex((p) => s.toLowerCase().indexOf(p.toLowerCase()) > -1); return i < 0 ? 99 : i; };
const key = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").slice(0, 80);

function pick(groups) {
  const seen = new Set(), out = [];
  for (const list of groups) {
    const good = list.filter((x) => rank(x.s) < 99);
    const pool = (good.length >= 3 ? good : list)
      .sort((a, b) => (b.d || "").localeCompare(a.d || ""))
      .slice(0, 6);
    for (const x of pool) { const k = key(x.t); if (!seen.has(k)) { seen.add(k); out.push(x); } }
  }
  return out.sort((a, b) => (b.d || "").localeCompare(a.d || "")).slice(0, 30);
}

async function fetchTopic(topic) {
  const url = BASE + "?q=" + encodeURIComponent(topic.q + " when:1d") + "&hl=en-US&gl=US&ceid=US:en";
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; OnluBrief/1.0)" } });
    return r.ok ? parse(await r.text(), topic.c) : [];
  } finally { clearTimeout(timer); }
}

module.exports = async (req, res) => {
  const results = await Promise.allSettled(TOPICS.map(fetchTopic));
  const items = pick(results.map((r) => (r.status === "fulfilled" ? r.value : [])));
  res.setHeader("Cache-Control", items.length ? "public, s-maxage=1800, stale-while-revalidate=3600" : "no-store");
  res.status(200).json({ updated: new Date().toISOString(), items });
};
module.exports.parse = parse;
module.exports.pick = pick;
