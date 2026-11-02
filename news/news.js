/* Onlu Brief: one card template shared by the browser and tools/build-news.js,
   so the cards written into the HTML (for search engines and link previews)
   match the ones the page draws after loading the host's newer posts. */
(function (root) {
  "use strict";

  var AREAS = {
    "Credit": "#2ee0d0", "Macro": "#8a9bff", "AI": "#4cc4ff", "Tech": "#4d84ff",
    "Healthcare": "#ff4f9a", "Consumer": "#ffc35a", "Real estate": "#ff8a65", "Resources": "#6fe39a"
  };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "")) ? String(u) : "#"; }
  function day(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? MONTHS[+m[2] - 1] + " " + (+m[3]) + ", " + m[1] : "";
  }
  function color(area) { return AREAS[area] || "#9befe4"; }

  // newest first; host posts and the built-in list merged by id
  function merge(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (it) { if (it && it.id && !seen[it.id]) { seen[it.id] = 1; out.push(it); } });
    return out.sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); });
  }

  function sources(it) {
    return (it.src || []).map(function (s) {
      return '<a href="' + esc(safeUrl(s.u)) + '" target="_blank" rel="noopener">' + esc(s.n) + "</a>";
    }).join(" · ");
  }

  // compact card for the homepage
  function teaser(it) {
    return '<article class="brief-card" style="--ac:' + color(it.area) + '">' +
      '<div class="brief-meta"><span class="brief-area">' + esc(it.area) + '</span><time datetime="' + esc(it.date) + '">' + esc(day(it.date)) + "</time></div>" +
      '<h3 class="brief-title"><a href="/news/#' + esc(it.id) + '">' + esc(it.title) + "</a></h3>" +
      (it.short ? '<p class="brief-short">' + esc(it.short) + "</p>" : "") +
      '<p class="brief-src">' + sources(it) + "</p>" +
      "</article>";
  }

  // full story for /news
  function story(it) {
    var why = Array.isArray(it.why) ? it.why : (it.why ? [it.why] : []);
    return '<article class="story" id="' + esc(it.id) + '" data-area="' + esc(it.area) + '" style="--ac:' + color(it.area) + '">' +
      '<div class="brief-meta"><span class="brief-area">' + esc(it.area) + '</span><time datetime="' + esc(it.date) + '">' + esc(day(it.date)) + "</time></div>" +
      '<h2 class="story__title">' + esc(it.title) + "</h2>" +
      (it.short ? '<p class="story__short">' + esc(it.short) + "</p>" : "") +
      (it.what ? '<div class="story__row"><div class="story__k">What happened</div><p>' + esc(it.what) + "</p></div>" : "") +
      (why.length ? '<div class="story__row"><div class="story__k">Why it matters</div><ul>' + why.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul></div>" : "") +
      (it.take ? '<div class="story__row take"><div class="story__k">Onlu take</div><p>' + esc(it.take) + "</p></div>" : "") +
      '<div class="story__foot"><span class="brief-src">Sources: ' + sources(it) + '</span>' +
      '<a class="story__cta" href="/#waitlist">Talk it through at the next coffee →</a></div>' +
      "</article>";
  }

  // live headlines (Today in Finance)
  var CATS = { "Markets": "#ffc35a", "Economy": "#8a9bff", "Credit": "#2ee0d0", "Banking": "#4cc4ff",
               "AI": "#4d84ff", "Policy": "#93aec4", "Global": "#6fe39a" };
  function ago(iso) {
    var t = Date.parse(iso); if (!t) return "";
    var m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 60) return m + "m ago";
    var h = Math.round(m / 60); return h < 24 ? h + "h ago" : Math.round(h / 24) + "d ago";
  }
  function headline(it) {
    return '<li class="hl" style="--hc:' + (CATS[it.c] || "#9befe4") + '">' +
      '<div class="hl__meta"><span class="hl__cat">' + esc(it.c) + "</span>" + (it.s ? "<span>" + esc(it.s) + "</span>" : "") +
      (it.d ? "<span>" + esc(ago(it.d)) + "</span>" : "") + "</div>" +
      '<a class="hl__t" href="' + esc(safeUrl(it.u)) + '" target="_blank" rel="noopener">' + esc(it.t) + "</a></li>";
  }
  // fills a <ul> with headlines; returns quietly (with a note) if the feed is down
  function loadHeadlines(ul, limit, onDone) {
    fetch("/api/headlines").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var items = (d && d.items) || [];
      ul.innerHTML = items.length ? items.slice(0, limit).map(headline).join("")
        : '<li class="hl hl--empty">Live headlines are unavailable right now. Check back soon.</li>';
      if (onDone) onDone(d);
    }).catch(function () { ul.innerHTML = '<li class="hl hl--empty">Live headlines are unavailable right now. Check back soon.</li>'; });
  }

  // ---------- Market pulse (CPI + market tiles, from /api/markets) ----------
  function monthName(ym, long) {
    var m = /^(\d{4})-(\d{2})/.exec(ym || ""); if (!m) return "";
    var names = long ? ["January","February","March","April","May","June","July","August","September","October","November","December"] : MONTHS;
    return names[+m[2] - 1] + (long ? " " + m[1] : "");
  }
  function signed(x, unit) { return (x > 0 ? "+" : x < 0 ? "\u2212" : "") + Math.abs(x).toFixed(unit === "%" ? 2 : 1) + (unit || ""); }
  function fmtVal(t) {
    if (t.unit === "%") return t.v.toFixed(t.id === "UNRATE" ? 1 : 2) + "%";
    if (t.unit === "$") return "$" + t.v.toFixed(2);
    return Math.round(t.v).toLocaleString("en-US");
  }
  function fmtChange(t) {
    if (t.change == null) return "";
    var arrow = t.change > 0 ? "\u25b2 " : t.change < 0 ? "\u25bc " : "";
    var n = Math.abs(t.change);
    var txt = t.chg === "bp" ? n + " bp" : t.chg === "pt" ? n.toFixed(1) + " pt" : n.toFixed(1) + "%";
    return arrow + (t.change === 0 ? "unchanged" : txt) + " vs a month ago";
  }
  function asOf(d) { var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(d || ""); return m ? "as of " + MONTHS[+m[1] - 1] + " " + (+m[2]) : ""; }
  function tile(label, value, change, note) {
    return '<div class="mk-tile"><div class="mk-l">' + esc(label) + '</div><div class="mk-v">' + esc(value) + "</div>" +
      (change ? '<div class="mk-c">' + esc(change) + "</div>" : "") + (note ? '<div class="mk-d">' + esc(note) + "</div>" : "") + "</div>";
  }
  function cpiCard(c) {
    var vals = c.history.map(function (h) { return h.yoy; });
    var hi = Math.max.apply(null, vals.concat([c.target])) * 1.18;
    var pct = function (v) { return Math.max(0, Math.min(100, v / hi * 100)); };
    var last = c.history.length - 1;
    var bars = c.history.map(function (h, i) {
      var tip = monthName(h.m, true) + ": " + h.yoy.toFixed(2) + "% year over year";
      return '<button type="button" class="cpi-bar' + (i === last ? " is-last" : "") + (i >= last - 3 ? " tip-r" : i <= 2 ? " tip-l" : "") +
        '" style="height:' + pct(h.yoy).toFixed(1) + '%" data-tip="' + esc(tip) + '" aria-label="' + esc(tip) + '">' +
        (i === last ? '<span class="cpi-val">' + h.yoy.toFixed(2) + "%</span>" : "") + "</button>";
    }).join("");
    var rows = c.history.map(function (h) { return "<tr><td>" + esc(monthName(h.m, true)) + "</td><td>" + h.yoy.toFixed(2) + "%</td></tr>"; }).join("");
    return '<div class="cpi">' +
      '<div class="cpi-k">CPI inflation</div><div class="cpi-sub">' + esc(monthName(c.month, true)) + " \u00b7 All urban consumers</div>" +
      '<div class="cpi-stats">' +
        '<div><span>Index</span><b>' + c.index.toFixed(1) + "</b></div>" +
        '<div><span>Year over year</span><b>' + signed(c.yoy, "%") + "</b></div>" +
        '<div><span>Month over month</span><b>' + (c.mom == null ? "\u2014" : signed(c.mom, "%")) + "</b></div>" +
        '<div><span>Fed target</span><b>' + c.target.toFixed(1) + "%</b></div>" +
      "</div>" +
      '<div class="cpi-k2">Year-over-year change, last 12 months</div>' +
      '<div class="cpi-plot" role="group" aria-label="CPI year-over-year change by month">' +
        '<div class="cpi-target" style="bottom:' + pct(c.target).toFixed(1) + '%"><span>Fed 2% target</span></div>' + bars + "</div>" +
      '<div class="cpi-x">' + c.history.map(function (h) { return "<span>" + esc(monthName(h.m)) + "</span>"; }).join("") + "</div>" +
      '<details class="cpi-table"><summary>Show as table</summary><table><thead><tr><th>Month</th><th>Year over year</th></tr></thead><tbody>' + rows + "</tbody></table></details>" +
      "</div>";
  }
  // full: CPI card + every tile (for /news); compact: four tiles (for the homepage)
  function loadMarkets(el, compact) {
    fetch("/api/markets").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || (!d.cpi && !d.fed && !(d.tiles || []).length)) { el.hidden = true; return; }
      var byId = {}; (d.tiles || []).forEach(function (t) { byId[t.id] = t; });
      var tiles = [];
      if (compact && d.cpi) tiles.push(tile("CPI inflation", signed(d.cpi.yoy, "%"), "year over year", monthName(d.cpi.month, true)));
      if (d.fed) tiles.push(tile("Fed funds target", d.fed.lo.toFixed(2) + "\u2013" + d.fed.hi.toFixed(2) + "%", "", asOf(d.fed.d)));
      (compact ? ["DGS10", "BAMLH0A0HYM2"] : ["DGS2", "DGS10", "DGS30", "T10Y2Y", "BAMLH0A0HYM2", "UNRATE", "DCOILBRENTEU", "SP500"]).forEach(function (id) {
        var t = byId[id]; if (t) tiles.push(tile(t.label, fmtVal(t), t.monthly ? fmtChange(t).replace("a month ago", "the month before") : fmtChange(t),
          t.monthly ? monthName(t.d.slice(0, 7), true) : asOf(t.d)));
      });
      el.querySelector(".mk-body").innerHTML = (!compact && d.cpi ? cpiCard(d.cpi) : "") + '<div class="mk-tiles">' + tiles.join("") + "</div>";
      el.hidden = false;
    }).catch(function () { el.hidden = true; });
  }

  var api = { AREAS: AREAS, CATS: CATS, esc: esc, day: day, merge: merge, teaser: teaser, story: story, headline: headline, loadHeadlines: loadHeadlines, loadMarkets: loadMarkets };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OnluNews = api;
})(this);
