/* Coffee with Onlu: swap the old line-art cup for the latte logo.
   Any <svg> drawn from the old cup path (inline or injected by a page's own
   script) is replaced with the latte mark at a slightly larger size, and the
   tab icon becomes the latte mark too. Load with:
     <script src="/lib/logo.js" defer></script> */
(function () {
  "use strict";
  var n = 0;
  function mark(size) {
    var id = "latte-g" + (n++);
    return '<svg viewBox="130 130 740 740" width="' + size + '" height="' + size + '" aria-hidden="true" style="display:block;flex:none">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9befe4"/><stop offset=".4" stop-color="#2ee0d0"/>' +
      '<stop offset=".7" stop-color="#4cc4ff"/><stop offset="1" stop-color="#c58bd6"/></linearGradient></defs>' +
      '<circle cx="500" cy="500" r="330" fill="url(#' + id + ')"/><circle cx="500" cy="500" r="268" fill="#4a2c1f"/>' +
      '<path d="M410 395 H590 A80 80 0 0 1 670 475 V505 A80 80 0 0 1 590 585 H460 L392 640 L408 578 A80 80 0 0 1 330 505 V475 A80 80 0 0 1 410 395 Z" fill="#f3e6d3"/>' +
      '<circle cx="430" cy="490" r="20" fill="#5a3624"/><circle cx="500" cy="490" r="20" fill="#5a3624"/><circle cx="570" cy="490" r="20" fill="#5a3624"/></svg>';
  }
  function swap() {
    var svgs = document.querySelectorAll("svg");
    for (var i = 0; i < svgs.length; i++) {
      var s = svgs[i], p = s.querySelector("path");
      if (!p || (p.getAttribute("d") || "").indexOf("M5 9h11v4") !== 0) continue;
      var box = s.getBoundingClientRect(), size = Math.round(Math.max(box.width, box.height, 16) * 1.25);
      var holder = document.createElement("span");
      holder.innerHTML = mark(size);
      var fresh = holder.firstChild;
      if (s.getAttribute("class")) fresh.setAttribute("class", s.getAttribute("class"));
      fresh.style.width = size + "px"; fresh.style.height = size + "px";
      s.parentNode.replaceChild(fresh, s);
    }
    var icon = document.querySelector('link[rel="icon"]');
    var data = "data:image/svg+xml," + encodeURIComponent(mark(64).replace(' aria-hidden="true" style="display:block;flex:none"', ' xmlns="http://www.w3.org/2000/svg"'));
    if (icon) icon.href = data;
    else { icon = document.createElement("link"); icon.rel = "icon"; icon.href = data; document.head.appendChild(icon); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", swap); else swap();
})();
