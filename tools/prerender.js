// Bake the Chinese render into the page's empty containers, so crawlers and link
// previews see the content without running JS. The script still repaints on toggle.
// Re-running first strips the previous bake (everything between the pre markers).
// Usage: node tools/prerender.js newsroom/index.html   (re-run after editing the page text)
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs");
const path = require("path");
const TAGS = "(?:p|div|ol|ul|span|h2)";
const file = process.argv[2];
(async () => {
  const src = fs.readFileSync(file, "utf8").replace(/<!--pre-->[\s\S]*?<!--\/pre-->/g, "");
  fs.writeFileSync(file, src);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route(/^https?:/, (r) => r.abort());
  await p.goto("file://" + path.resolve(file) + "?lang=zh");
  const ids = [...src.matchAll(new RegExp('id="([\\w-]+)"[^>]*></' + TAGS + '>', "g"))].map((m) => m[1]);
  const html = await p.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, document.getElementById(id).innerHTML])), ids);
  await b.close();
  let out = src;
  for (const id of ids)
    out = out.replace(new RegExp('(id="' + id + '"[^>]*>)(</' + TAGS + '>)'), (_, a, c) => a + "<!--pre-->" + html[id] + "<!--/pre-->" + c);
  fs.writeFileSync(file, out);
  console.log("baked", ids.join(","));
})();
