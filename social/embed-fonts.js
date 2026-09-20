// Download every woff2 referenced by the Google Fonts CSS and inline it as a
// data: URI, so the poster renders identically without any network at all.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const dir = __dirname + "/fonts";
let css = fs.readFileSync(dir + "/gf.css", "utf8");
const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com[^)]*/g))];

let n = 0;
for (const url of urls) {
  const file = path.join(dir, path.basename(url));
  if (!fs.existsSync(file)) {
    execFileSync("curl", ["-sS", "--max-time", "30", url, "-o", file]);
  }
  const b64 = fs.readFileSync(file).toString("base64");
  css = css.split(url).join("data:font/woff2;base64," + b64);
  n++;
}

fs.writeFileSync(__dirname + "/fonts.css", css);
console.log("embedded", n, "font files;", (css.length / 1024 / 1024).toFixed(2), "MB");
