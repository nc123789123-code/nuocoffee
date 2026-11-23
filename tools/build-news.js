// Write the Onlu Brief stories from news/items.json into the HTML, so search
// engines and link previews see them without running JS. Re-run after editing
// items.json:  node tools/build-news.js
// Stories the host posts from the members area are added by the pages at load.
const fs = require("fs");
const path = require("path");
const N = require("../news/news.js");

const root = path.join(__dirname, "..");
const items = N.merge(JSON.parse(fs.readFileSync(path.join(root, "news/items.json"), "utf8")), []);
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");   // safe inside <script>

function fill(file, pairs) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, "utf8");
  for (const [re, html] of pairs) {
    if (!re.test(s)) throw new Error(file + ": marker not found for " + re);
    s = s.replace(re, (_, a, b) => a + html + b);
  }
  fs.writeFileSync(p, s);
}

// ---------- Fund spotlight (news/fund.json) ----------
const F = JSON.parse(fs.readFileSync(path.join(root, "news/fund.json"), "utf8"));
const e = N.esc;
const fundFull =
  '<section class="fund" id="fund" aria-labelledby="fund-h">' +
  '<p class="fund-k">Fund spotlight</p>' +
  '<h2 id="fund-h" class="fund-t">' + e(F.name) + ' <span class="fund-tk">' + e(F.ticker) + "</span></h2>" +
  '<p class="fund-dek">' + e(F.dek) + "</p>" +
  '<dl class="fund-facts"><div><dt>Manager</dt><dd>' + e(F.manager) + "</dd></div><div><dt>Launched</dt><dd>" + e(F.launched) + "</dd></div>" +
  "<div><dt>Size</dt><dd>" + e(F.size) + "</dd></div><div><dt>Structure</dt><dd>" + e(F.type) + "</dd></div>" +
  "<div><dt>Liquidity</dt><dd>" + e(F.liquidity) + "</dd></div></dl>" +
  '<h3 class="fund-h3">History</h3><ol class="fund-tl">' + F.timeline.map((t) => '<li><span class="fund-when">' + e(t.when) + "</span><p>" + e(t.what) + "</p></li>").join("") + "</ol>" +
  '<div class="fund-cols"><div><h3 class="fund-h3">Why it matters</h3><ul>' + F.why.map((x) => "<li>" + e(x) + "</li>").join("") + "</ul></div>" +
  '<div><h3 class="fund-h3">What to watch</h3><ul>' + F.watch.map((x) => "<li>" + e(x) + "</li>").join("") + "</ul></div></div>" +
  '<p class="fund-src">Sources: ' + F.src.map((x) => '<a href="' + e(x.u) + '" target="_blank" rel="noopener">' + e(x.n) + "</a>").join(" · ") +
  " · Figures as reported; not investment advice. Updated " + e(F.updated) + ".</p></section>";
const fundHome =
  '<a class="fund-card" href="/news/#fund"><span class="fund-k">Fund spotlight</span>' +
  '<span class="fund-t">' + e(F.name) + ' <span class="fund-tk">' + e(F.ticker) + "</span></span>" +
  '<span class="fund-dek">' + e(F.dek) + '</span><span class="fund-more">Its history, from ' + e(F.timeline[0].when) + " to today →</span></a>";

fill("news/index.html", [
  [/(<!--news:all-->)[\s\S]*?(<!--\/news:all-->)/, items.map(N.story).join("\n")],
  [/(<script type="application\/json" id="news-data">)[\s\S]*?(<\/script>)/, json(items)],
  [/(<!--fund-->)[\s\S]*?(<!--\/fund-->)/, fundFull],
]);
fill("index.html", [
  [/(<!--news:home-->)[\s\S]*?(<!--\/news:home-->)/, items.slice(0, 3).map(N.teaser).join("\n")],
  [/(<script type="application\/json" id="news-home-data">)[\s\S]*?(<\/script>)/, json(items.slice(0, 6))],
  [/(<!--fund:home-->)[\s\S]*?(<!--\/fund:home-->)/, fundHome],
]);
console.log("built", items.length, "stories; homepage shows", Math.min(3, items.length));
