# Social cards

Event posters for Instagram / 小红书 / 朋友圈 / LinkedIn, drawn with the same
palette and type as the site so they read as one brand.

## Regenerating

Requires Node and Playwright's Chromium (both preinstalled in the dev container).

```sh
node embed-fonts.js   # once — inlines the web fonts into fonts.css (gitignored)
node shoot.js         # event cards  → ./out
node shoot-logo.js    # logo marks   → ./out
```

`embed-fonts.js` needs `fonts/gf.css`, the Google Fonts stylesheet for Unbounded /
Outfit / Space Mono. Fetch it with a desktop user-agent so Google serves woff2:

```sh
mkdir -p fonts && curl -sS -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" \
"https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Outfit:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" \
-o fonts/gf.css
```

Opening `poster.html` in a browser works without either step — it falls back to
the Google Fonts CDN.

## For the next event

Edit the four cards in `poster.html` (the date strip, title and bullets), then
rerun `shoot.js`. The sizes are:

| Card       | Size      | Where it goes                          |
|------------|-----------|----------------------------------------|
| `square`   | 1080×1080 | 朋友圈, LinkedIn, IG feed               |
| `portrait` | 1080×1350 | IG feed, 小红书 (best reach)            |
| `story`    | 1080×1920 | IG / WeChat story                      |
| `cn`       | 1080×1350 | 小红书 / 朋友圈, bilingual              |

The Chinese card uses whatever CJK face the machine has (WenQuanYi Zen Hei in the
container). Swap in a nicer one via the `.zh` rule in `poster.html` if you have it.

## Logo marks

`logo.html` holds four square marks, all 1000×1000, drawn from the same cup icon
the site uses in `ICONS.coffee`:

| File | What it is | Use it for |
|---|---|---|
| `onlu-logo-avatar-1000.png` | gradient cup on navy | default profile / host avatar |
| `onlu-logo-avatar-gradient-1000.png` | navy cup on gradient | when you need it to pop in a crowded list |
| `onlu-logo-mark-transparent-1000.png` | cup alone, alpha channel | over a photo, or on a light background |
| `onlu-logo-lockup-1000.png` | cup + "Coffee with Onlu" | anywhere with room for the wordmark |

The marks sit inside the centre ~84% of the square, so a circular crop takes
nothing off. `logo.html` draws that safe circle as a guide; `shoot-logo.js` hides
it before the screenshot.

