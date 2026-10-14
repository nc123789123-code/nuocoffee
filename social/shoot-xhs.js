// Render Xiaohongshu covers (3:4) and report anything that spills past the safe margin.
// Usage: node shoot-xhs.js <page.html> <cardId>=<out.png> [...]
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const [page_, ...shots] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2400, height: 1600 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(__dirname, page_ || "xhs.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  for (const s of shots.length ? shots : ["xhs=onlu-finai-1017-xhs-1080x1440.png"]) {
    const [id, file] = s.split("=");
    const spill = await page.evaluate((id) => {
      const card = document.getElementById(id).getBoundingClientRect();
      return [...document.querySelectorAll("#" + id + " > :not(.blob):not(.grid):not(svg), #" + id + " .bottom *")]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.right > card.right - 60 || r.bottom > card.bottom - 60 || r.top < card.top + 60; })
        .map((el) => el.className || el.tagName);
    }, id);
    await page.locator("#" + id).screenshot({ path: path.join(OUT, file) });
    console.log(file, spill.length ? "SPILL " + spill.join(",") : "ok");
  }
  await browser.close();
})();
