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
  function loadMarkets(el, compact, onData) {
    fetch("/api/markets").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || (!d.cpi && !d.fed && !(d.tiles || []).length)) { unavailable(); return; }
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
      if (onData) onData(d);
    }).catch(unavailable);
    // the homepage strip just stays hidden; /news says so, so an outage is visible
    function unavailable() {
      if (compact) { el.hidden = true; return; }
      el.querySelector(".mk-body").innerHTML = '<p class="hl hl--empty">Market data is unavailable right now. Check back soon.</p>';
      el.hidden = false;
    }
  }

  // ---------- Markets now (index levels and today's change, refreshed every minute) ----------
  function num(v, d) { return Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function qVal(q) {
    if (q.kind === "yield") return num(q.v, 2) + "%";
    if (q.kind === "price") return "$" + num(q.v, q.v >= 1000 ? 0 : 2);
    return num(q.v, q.id === "VIX" ? 2 : 2);
  }
  function qChg(q) {
    if (q.pct == null) return "";
    var up = q.chg > 0, flat = q.chg === 0;
    var arrow = flat ? "●" : up ? "▲" : "▼";
    var sign = up ? "+" : flat ? "" : "−";
    var main = q.kind === "yield" ? sign + Math.abs(q.chg).toFixed(1) + " bp" : sign + Math.abs(q.pct).toFixed(2) + "%";
    if (q.basis) main += " " + q.basis;
    var sub = q.kind === "yield" ? "" : ' <span class="qt-abs">' + sign + num(Math.abs(q.chg), q.kind === "price" && q.v >= 1000 ? 0 : 2) + "</span>";
    return '<div class="qt-c ' + (flat ? "flat" : up ? "up" : "down") + '"><span aria-hidden="true">' + arrow + "</span> " + main + sub + "</div>";
  }
  function spark(q) {
    var p = q.spark || [];
    if (p.length < 3) return '<div class="qt-sp qt-sp--none"></div>';
    var all = p.concat(q.prev != null ? [q.prev] : []);
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), span = hi - lo || 1;
    var y = function (v) { return (26 - (v - lo) / span * 24).toFixed(1); };
    var pts = p.map(function (v, i) { return (i / (p.length - 1) * 100).toFixed(1) + "," + y(v); }).join(" ");
    var base = q.prev != null ? '<line x1="0" x2="100" y1="' + y(q.prev) + '" y2="' + y(q.prev) + '" class="qt-base"/>' : "";
    return '<svg class="qt-sp" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">' + base +
      '<polyline points="' + pts + '" vector-effect="non-scaling-stroke"/></svg>';
  }
  function etTime(iso) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";
  }
  function quotesHtml(d, limit) {
    var items = (d.items || []).slice(0, limit || 99);
    return '<div class="qt-list" style="--qn:' + items.length + '">' + items.map(function (q) {
      return '<div class="qt-item"><div class="qt-l">' + esc(q.label) + '</div><div class="qt-v">' + qVal(q) + "</div>" +
        qChg(q) + '<div class="qt-sp-w ' + (q.chg > 0 ? "up" : q.chg < 0 ? "down" : "flat") + '">' + spark(q) + "</div></div>";
    }).join("") + "</div>";
  }
  function loadQuotes(el, limit) {
    if (!el) return;
    var body = el.querySelector(".qt-body"), st = el.querySelector(".qt-status");
    function load() {
      fetch("/api/quotes").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || !d.items || !d.items.length) { fail(); return; }
        body.innerHTML = quotesHtml(d, limit);
        var daily = d.items.every(function (q) { return q.daily; });
        if (st) st.innerHTML = daily ? "As of the last close" : (d.open === true ? '<span class="qt-dot"></span>U.S. market open' : d.open === false ? "U.S. market closed" : "") +
          (d.updated ? (d.open != null ? " · " : "") + "updated " + etTime(d.updated) : "");
        el.hidden = false;
      }).catch(fail);
    }
    // keep what's showing; on /news say so, on the homepage just stay hidden
    function fail() {
      if (body.querySelector(".qt-list")) return;
      if (el.hasAttribute("data-quiet")) { el.hidden = true; return; }
      body.innerHTML = '<p class="hl hl--empty">Live quotes are unavailable right now. Check back soon.</p>';
      el.hidden = false;
    }
    load();
    setInterval(function () { if (document.visibilityState === "visible") load(); }, 60000);
  }

  // ---------- Key dates (official release calendars; 8:30 AM ET unless noted) ----------
  var BLS_SCHED = "https://www.bls.gov/schedule/news_release/current_year.asp";
  var BEA_SCHED = "https://www.bea.gov/news/schedule/2026";
  var FED_CAL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
  var CENSUS = "https://www.census.gov/retail/release_schedule.html";
  var CAL = [
    { d: "2026-11-06", t: "8:30 AM", e: "Jobs report", x: "October payrolls and unemployment rate", src: BLS_SCHED },
    { d: "2026-11-10", t: "8:30 AM", e: "CPI inflation", x: "October consumer prices", src: BLS_SCHED },
    { d: "2026-11-17", t: "8:30 AM", e: "Retail sales", x: "October retail and food services sales", src: CENSUS },
    { d: "2026-11-25", t: "8:30 AM", e: "GDP and PCE", x: "Q3 GDP second estimate; October PCE inflation and spending", src: BEA_SCHED },
    { d: "2026-12-04", t: "8:30 AM", e: "Jobs report", x: "November payrolls and unemployment rate", src: BLS_SCHED },
    { d: "2026-12-09", t: "2:00 PM", e: "Fed decision", x: "FOMC rate decision, projections and dot plot (Dec 8\u20139)", src: FED_CAL },
    { d: "2026-12-10", t: "8:30 AM", e: "CPI inflation", x: "November consumer prices", src: BLS_SCHED },
    { d: "2026-12-15", t: "8:30 AM", e: "PPI", x: "November producer prices", src: BLS_SCHED },
    { d: "2026-12-23", t: "8:30 AM", e: "PCE inflation", x: "November PCE; Q3 GDP third estimate", src: BEA_SCHED },
    { d: "2027-01-27", t: "2:00 PM", e: "Fed decision", x: "FOMC rate decision (Jan 26\u201327, tentative)", src: FED_CAL }
  ];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function todayET() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); }
  function daysUntil(iso) { return Math.round((Date.parse(iso + "T12:00:00Z") - Date.parse(todayET() + "T12:00:00Z")) / 864e5); }
  function calendarHtml(limit) {
    var up = CAL.filter(function (c) { return c.d >= todayET(); }).slice(0, limit || 6);
    if (!up.length) return '<p class="hl hl--empty">No dates scheduled yet.</p>';
    return '<ol class="cal">' + up.map(function (c) {
      var dt = new Date(c.d + "T12:00:00Z"), n = daysUntil(c.d);
      return '<li class="cal-row"><div class="cal-date"><span>' + WEEKDAYS[dt.getUTCDay()] + "</span><b>" + MONTHS[dt.getUTCMonth()] + " " + dt.getUTCDate() + "</b></div>" +
        '<div class="cal-main"><div class="cal-e">' + esc(c.e) + '<span class="cal-in">' + (n === 0 ? "Today" : n === 1 ? "Tomorrow" : "in " + n + " days") + "</span></div>" +
        '<div class="cal-x">' + esc(c.x) + " \u00b7 " + esc(c.t) + ' ET \u00b7 <a href="' + esc(c.src) + '" target="_blank" rel="noopener">schedule</a></div></div></li>';
    }).join("") + "</ol>";
  }

  // ---------- Summary, written from the numbers (no AI, nothing invented) ----------
  function tone(x, posAt, negAt) {   // posAt/negAt: thresholds; sign tells direction
    if (x == null) return "Neutral";
    if (posAt > 0 ? x >= posAt : x <= posAt) return "Positive";
    if (negAt > 0 ? x >= negAt : x <= negAt) return "Negative";
    return "Neutral";
  }
  function nextCpi() {
    var n = CAL.filter(function (x) { return x.e === "CPI inflation" && x.d >= todayET(); })[0];
    if (!n) return "";
    var dt = new Date(n.d + "T12:00:00Z");
    return "Next CPI: " + MONTHS[dt.getUTCMonth()] + " " + dt.getUTCDate();
  }
  function bp(x) { return Math.abs(x) + " bp"; }
  function pc(x) { return Math.abs(x).toFixed(1) + "%"; }
  function summary(d) {
    var by = {}; (d.tiles || []).forEach(function (t) { by[t.id] = t; });
    var spx = by.SP500, y10 = by.DGS10, y30 = by.DGS30, y2 = by.DGS2, curve = by.T10Y2Y, hy = by.BAMLH0A0HYM2, oil = by.DCOILBRENTEU, ur = by.UNRATE, c = d.cpi;
    var cards = [], head = [], infl = "";
    if (spx && spx.change != null) {
      var moved = Math.abs(spx.change) < 0.5 ? "were little changed" : (spx.change > 0 ? "rose " : "fell ") + pc(spx.change);
      head.push("stocks " + moved + " over the past month");
      cards.push({ k: "U.S. Equity", tag: tone(spx.change, 1, -1),
        line: "The S&P 500 is at " + fmtVal(spx) + ", " + (Math.abs(spx.change) < 0.5 ? "about flat" : (spx.change > 0 ? "up " : "down ") + pc(spx.change)) + " over the past month.",
        pts: ["Level: " + fmtVal(spx) + " (" + asOf(spx.d) + ")", "One-month change: " + (spx.change > 0 ? "+" : spx.change < 0 ? "\u2212" : "") + pc(spx.change)] });
    }
    if (y10 && y10.change != null) {
      var dir = y10.change === 0 ? "was unchanged at " : (y10.change > 0 ? "rose " : "fell ") + bp(y10.change) + " to ";
      head.push("the 10-year Treasury yield " + dir + fmtVal(y10));
      var pts = [];
      if (y2) pts.push("2-year: " + fmtVal(y2) + (y2.change != null ? " (" + (y2.change >= 0 ? "+" : "\u2212") + bp(y2.change) + ")" : ""));
      if (curve) pts.push("2s10s curve: " + (curve.v >= 0 ? "+" : "\u2212") + Math.round(Math.abs(curve.v) * 100) + " bp" + (curve.v >= 0 ? " (upward sloping)" : " (inverted)"));
      cards.push({ k: "Rates", tag: tone(y10.change, -10, 10),
        line: "The 10-year yield " + dir + fmtVal(y10) + " over the month" + (y30 ? "; the 30-year is at " + fmtVal(y30) : "") + ".", pts: pts });
    }
    if (hy && hy.change != null) {
      cards.push({ k: "Credit", tag: tone(hy.change, -10, 10),
        line: "High-yield spreads " + (hy.change === 0 ? "were unchanged" : (hy.change > 0 ? "widened " : "tightened ") + bp(hy.change)) + " to " + Math.round(hy.v * 100) + " bp over Treasuries.",
        pts: ["Wider spreads mean investors want more to hold riskier debt", "One-month change: " + (hy.change >= 0 ? "+" : "\u2212") + bp(hy.change)] });
    }
    if (c) {
      var prev = c.history.length > 1 ? c.history[c.history.length - 2].yoy : null;
      var rising = prev != null && c.yoy > prev;
      var gap = c.yoy - c.target;
      var mtag = c.yoy > 3 && rising ? "Negative" : c.yoy <= 2.5 && !rising ? "Positive" : "Neutral";
      var fedTxt = d.fed ? ", with the Fed funds range at " + d.fed.lo.toFixed(2) + "\u2013" + d.fed.hi.toFixed(2) + "%" : "";
      cards.push({ k: "Macro & Fed", tag: mtag,
        line: "CPI inflation is " + c.yoy.toFixed(2) + "% year over year, " + (gap >= 0 ? Math.abs(gap).toFixed(2) + " points above" : Math.abs(gap).toFixed(2) + " points below") + " the Fed's 2% target" + fedTxt + ".",
        pts: ["CPI month over month: " + (c.mom == null ? "n/a" : (c.mom >= 0 ? "+" : "\u2212") + Math.abs(c.mom).toFixed(2) + "%") + (prev != null ? (rising ? ", inflation rising" : ", inflation easing") : ""),
              ur ? "Unemployment: " + fmtVal(ur) + " (" + monthName(ur.d.slice(0, 7), true) + ")" : "", nextCpi()].filter(Boolean) });
      infl = "inflation is running at " + c.yoy.toFixed(2) + "%, " + (gap >= 0 ? "above" : "below") + " the Fed's 2% target";
    }
    if (oil && oil.change != null) {
      cards.push({ k: "Oil", tag: Math.abs(oil.change) < 3 ? "Steady" : oil.change > 0 ? "Rising" : "Falling",
        line: "Brent is at " + fmtVal(oil) + " a barrel, " + (Math.abs(oil.change) < 1 ? "about flat" : (oil.change > 0 ? "up " : "down ") + pc(oil.change)) + " over the past month.",
        pts: ["Higher oil feeds inflation and squeezes airlines and consumers", "Lower oil eases both"] });
    }
    if (!cards.length) return "";
    var cap = function (x) { return x.charAt(0).toUpperCase() + x.slice(1) + "."; };
    var text = [head.join(", while "), infl].filter(Boolean).map(cap).join(" ");
    return '<div class="sum-head">' + esc(text) + "</div>" + '<div class="sum-cards">' + cards.map(function (k) {
      var cls = k.tag === "Positive" ? "pos" : k.tag === "Negative" ? "neg" : "neu";
      return '<div class="sum-card"><div class="sum-top"><span class="sum-k">' + esc(k.k) + '</span><span class="sum-tag ' + cls + '">' + esc(k.tag) + "</span></div>" +
        '<p class="sum-line">' + esc(k.line) + "</p>" + (k.pts.length ? "<ul>" + k.pts.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
    }).join("") + "</div>";
  }
  function headlineOnly(d) { var m = /<div class="sum-head">([\s\S]*?)<\/div>/.exec(summary(d)); return m ? m[1] : ""; }

  var api = { AREAS: AREAS, CATS: CATS, esc: esc, day: day, merge: merge, teaser: teaser, story: story, headline: headline, loadHeadlines: loadHeadlines,
              loadMarkets: loadMarkets, loadQuotes: loadQuotes, quotesHtml: quotesHtml, calendarHtml: calendarHtml, summary: summary, headlineOnly: headlineOnly };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OnluNews = api;
})(this);
