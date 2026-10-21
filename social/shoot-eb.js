// Render the Eventbrite banner at 2x (2160×1080) and flag anything outside a 30px margin.
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const path = require("path");
const fs = require("fs");
fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1200, height:700 }, deviceScaleFactor:2 });
  await p.goto("file://" + path.join(__dirname, "eventbrite-newsroom.html"));
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const spill = await p.evaluate(() => {
    const c = document.getElementById("eb").getBoundingClientRect();
    return [...document.querySelectorAll("#eb .left *, #eb .site, #eb .dk.front")].filter(e => {
      const r = e.getBoundingClientRect(); return r.right > c.right - 30 || r.bottom > c.bottom - 30 || r.top < c.top + 30 || r.left < c.left + 30;
    }).map(e => e.className || e.tagName);
  });
  const file = path.join(__dirname, "out/onlu-newsroom-eventbrite-2160x1080.png");
  await p.locator("#eb").screenshot({ path: file });
  console.log(spill.length ? "SPILL " + spill : "ok", file); await b.close();
})();
