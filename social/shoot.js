const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const path = require("path");
const fs = require("fs");

const OUT = process.argv[2] || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { id: "square",   file: "onlu-credit-0926-square-1080.png" },
  { id: "portrait", file: "onlu-credit-0926-portrait-1080x1350.png" },
  { id: "story",    file: "onlu-credit-0926-story-1080x1920.png" },
  { id: "cn",       file: "onlu-credit-0926-cn-1080x1350.png" },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto("file://" + path.join(__dirname, "poster.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  for (const s of SHOTS) {
    const el = page.locator("#" + s.id);
    const box = await el.boundingBox();
    await el.screenshot({ path: path.join(OUT, s.file) });
    console.log(s.file, "→", Math.round(box.width) + "×" + Math.round(box.height));
  }

  await browser.close();
})();
