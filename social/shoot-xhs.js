// Render the Xiaohongshu cover (3:4) and report anything that spills out of its box.
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const path = require("path");
const fs = require("fs");

const OUT = process.argv[2] || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(__dirname, "xhs.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const report = await page.evaluate(() => {
    const card = document.getElementById("xhs").getBoundingClientRect();
    const out = [];
    document.querySelectorAll("#xhs *:not(.blob):not(.grid)").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > card.right - 60 || r.bottom > card.bottom - 60) out.push(el.className || el.tagName);
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible") out.push("clip:" + el.className);
    });
    const fonts = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family + " " + f.weight);
    return { out, fonts: [...new Set(fonts)] };
  });
  console.log(JSON.stringify(report));

  const file = "onlu-finai-1017-xhs-1080x1440.png";
  await page.locator("#xhs").screenshot({ path: path.join(OUT, file) });
  console.log("wrote", file);
  await browser.close();
})();
