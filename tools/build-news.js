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

fill("news/index.html", [
  [/(<!--news:all-->)[\s\S]*?(<!--\/news:all-->)/, items.map(N.story).join("\n")],
  [/(<script type="application\/json" id="news-data">)[\s\S]*?(<\/script>)/, json(items)],
]);
fill("index.html", [
  [/(<!--news:home-->)[\s\S]*?(<!--\/news:home-->)/, items.slice(0, 3).map(N.teaser).join("\n")],
  [/(<script type="application\/json" id="news-home-data">)[\s\S]*?(<\/script>)/, json(items.slice(0, 6))],
]);
console.log("built", items.length, "stories; homepage shows", Math.min(3, items.length));
