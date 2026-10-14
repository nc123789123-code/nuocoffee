// Subset Noto Sans SC to just the CJK characters a poster uses (Google Fonts
// `text=`), then inline it as data: URIs under the family name 'Noto SC Sub'.
// Usage: node embed-sc.js xhs.html xhs2.html   (one subset covering every file)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const files = process.argv.length > 2 ? process.argv.slice(2) : ["xhs.html"];
const src = files.map((f) => fs.readFileSync(path.join(__dirname, f), "utf8")).join("");
const chars = [...new Set(src.match(/[^\x00-\x7f]/gu))].join("");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const api = "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@500;900&text=" + encodeURIComponent(chars);

let css = execFileSync("curl", ["-sS", "--max-time", "30", "-A", UA, api]).toString();
const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com[^)]*/g) || [])];
for (const url of urls) {
  const buf = execFileSync("curl", ["-sS", "--max-time", "30", url]);
  const fmt = /format\('(\w+)'\)/.exec(css.slice(css.indexOf(url)))[1];
  css = css.split(url).join("data:font/" + fmt + ";base64," + buf.toString("base64"));
}
css = css.replace(/font-family: 'Noto Sans SC'/g, "font-family: 'Noto SC Sub'");
fs.writeFileSync(path.join(__dirname, "fonts-sc.css"), css);
console.log(chars.length, "chars,", urls.length, "files,", (css.length / 1024).toFixed(0), "KB");
