const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { id: "navy",     file: "onlu-logo-avatar-1000.png" },
  { id: "gradient", file: "onlu-logo-avatar-gradient-1000.png" },
  { id: "clear",    file: "onlu-logo-mark-transparent-1000.png", transparent: true },
  { id: "lockup",   file: "onlu-logo-lockup-1000.png" },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto("file://" + path.join(__dirname, "logo.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  for (const s of SHOTS) {
    // The safe-area ring is a guide for composing the mark, not part of it.
    // omitBackground only drops the *default* white, so the body's own colour
    // has to come off too or the "transparent" mark ships opaque.
    await page.evaluate((transparent) => {
      document.querySelectorAll(".ring").forEach((el) => (el.style.display = "none"));
      document.body.style.background = transparent ? "transparent" : "#2a2a2a";
    }, !!s.transparent);
    await page.locator("#" + s.id).screenshot({
      path: path.join(OUT, s.file),
      omitBackground: !!s.transparent,
    });
    console.log(s.file + (s.transparent ? "  (transparent)" : ""));
  }

  await browser.close();
})();
