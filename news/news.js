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

  var api = { AREAS: AREAS, esc: esc, day: day, merge: merge, teaser: teaser, story: story };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OnluNews = api;
})(this);
