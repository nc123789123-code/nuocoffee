/* ============================================================
   Coffee with Onlu — front-end behavior
   - Renders the vertical grid from a single source of truth
   - Handles waitlist submission (client-side for now)
   ============================================================ */

(function () {
  "use strict";

  /* ---- Icon set: clean line icons, inherit currentColor so they glow
     in each accent. Keyed by name; rendered inline as SVG. ---- */
  const ICONS = {
    coffee:    '<path d="M5 9h11v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z"/><path d="M16 10h2.4a2.4 2.4 0 0 1 0 4.8H16"/><path d="M8 3.4c-.5 1 .5 1.6 0 2.6M11.5 3.4c-.5 1 .5 1.6 0 2.6"/>',
    bank:      '<path d="M3 9.5 12 4l9 5.5"/><path d="M5.5 11v6M9.5 11v6M14.5 11v6M18.5 11v6"/><path d="M3.5 20h17"/>',
    receipt:   '<path d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21Z"/><path d="M9 8h6M9 12h5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"/><path d="M3 12.5h18"/>',
    cpu:       '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v2.5M14 3v2.5M10 18.5V21M14 18.5V21M3 10h2.5M3 14h2.5M18.5 10H21M18.5 14H21"/>',
    chart:     '<path d="M4 5v14h16"/><path d="m7.5 14 3-3.2L13 13l4.2-5"/>',
    percent:   '<circle cx="7.5" cy="7.5" r="2.6"/><circle cx="16.5" cy="16.5" r="2.6"/><path d="M18 6 6 18"/>',
    calendar:  '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    clock:     '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 1.8"/>',
    pin:       '<path d="M12 21s6.8-5.4 6.8-11A6.8 6.8 0 1 0 5.2 10c0 5.6 6.8 11 6.8 11Z"/><circle cx="12" cy="10" r="2.4"/>',
  };

  function svg(name, cls) {
    var p = ICONS[name];
    if (!p) return "";
    return '<svg class="ico' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + p + "</svg>";
  }

  /* ============================================================
     THIS WEEK'S COFFEE — edit this each week (or set to null to hide).
     `formVertical` must match one of the dropdown options exactly so the
     RSVP button can pre-select it.
     ============================================================ */
  const THIS_WEEK = {
    vertical: "Private Credit",
    formVertical: "Private Credit",
    date: "Thursday, July 31",
    time: "8:00–8:45 AM",
    place: "Blue Bottle, FiDi",
    note: "6 seats · a few left",
  };

  // Accent colour + icon per vertical, kept in sync with the grid below.
  function styleFor(name) {
    var n = (name || "").toLowerCase();
    if (n.indexOf("private equity") > -1) return { c: "var(--amber)", i: "bank" };
    if (n.indexOf("private credit") > -1) return { c: "var(--amber)", i: "receipt" };
    if (n.indexOf("banking") > -1)        return { c: "var(--pink)",  i: "briefcase" };
    if (n.indexOf("quant") > -1)          return { c: "var(--mint)",  i: "cpu" };
    if (n.indexOf("public credit") > -1)  return { c: "var(--violet)", i: "percent" };
    if (n.indexOf("public") > -1)         return { c: "var(--violet)", i: "chart" };
    return { c: "var(--amber)", i: "coffee" };
  }

  function renderThisWeek() {
    var section = document.getElementById("thisweek");
    var host = document.getElementById("thisweekInner");
    if (!section || !host) return;
    if (!THIS_WEEK) { section.hidden = true; return; }

    var s = styleFor(THIS_WEEK.formVertical || THIS_WEEK.vertical);
    host.innerHTML =
      '<div class="tw-card" style="--tw:' + s.c + '">' +
        '<div class="tw-card__head">' +
          '<span class="tw-pill"><span class="tw-dot"></span>This week’s coffee</span>' +
          '<span class="tw-icon" aria-hidden="true">' + svg(s.i) + "</span>" +
        "</div>" +
        '<h2 class="tw-vertical">' + THIS_WEEK.vertical + "</h2>" +
        '<div class="tw-meta">' +
          (THIS_WEEK.date  ? "<span>" + svg("calendar") + THIS_WEEK.date + "</span>" : "") +
          (THIS_WEEK.time  ? "<span>" + svg("clock") + THIS_WEEK.time + "</span>" : "") +
          (THIS_WEEK.place ? "<span>" + svg("pin") + THIS_WEEK.place + "</span>" : "") +
        "</div>" +
        '<div class="tw-foot">' +
          (THIS_WEEK.note ? '<span class="tw-note">' + THIS_WEEK.note + "</span>" : "<span></span>") +
          '<button class="btn" type="button" id="twRsvp">RSVP for this table</button>' +
        "</div>" +
      "</div>";
    section.hidden = false;

    var rsvp = document.getElementById("twRsvp");
    if (rsvp) {
      rsvp.addEventListener("click", function () {
        var sel = document.getElementById("vertical");
        if (sel && THIS_WEEK.formVertical) {
          for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === THIS_WEEK.formVertical || sel.options[i].text === THIS_WEEK.formVertical) {
              sel.selectedIndex = i;
              break;
            }
          }
        }
        var target = document.getElementById("waitlist");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        var name = document.getElementById("name");
        if (name) setTimeout(function () { name.focus(); }, 500);
      });
    }
  }

  /* ---- Verticals: the taxonomy that defines the product ----
     Edit this list to add/remove/reorder verticals. The grid,
     and (eventually) matching, should read from here. */
  const VERTICALS = [
    { icon: "bank", name: "Private Equity & Credit", desc: "Buyout and growth investing, direct lending, mezzanine, and special situations.", tag: "Private markets" },
    { icon: "briefcase", name: "Investment Banking", desc: "M&A and coverage — analysts through MDs across advisory.", tag: "Sell side" },
    { icon: "cpu", name: "Quant / Systematic", desc: "Researchers and PMs in systematic and high-frequency strategies.", tag: "Systematic" },
    { icon: "chart", name: "Public Equity & Credit", desc: "Long/short and long-only equity, plus corporate, high-yield, and distressed credit.", tag: "Public markets" },
  ];

  function renderVerticals() {
    const grid = document.getElementById("verticalGrid");
    if (!grid) return;
    grid.innerHTML = VERTICALS.map(function (v) {
      return (
        '<article class="vert">' +
        '<span class="vert__tag">' + v.tag + "</span>" +
        '<div class="vert__icon" aria-hidden="true">' + svg(v.icon) + "</div>" +
        '<h3 class="vert__name">' + v.name + "</h3>" +
        '<p class="vert__desc">' + v.desc + "</p>" +
        "</article>"
      );
    }).join("");
  }

  /* ---- Waitlist form ----
     Posts to the Vercel serverless function at /api/waitlist, which
     validates and forwards the signup to a Google Sheet. See
     api/waitlist.js and sheets-endpoint.gs. */

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function setStatus(el, msg, kind) {
    el.textContent = msg;
    el.className = "form__status" + (kind ? " form__status--" + kind : "");
  }

  function submitSignup(data) {
    return fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          throw new Error(body.error || "Request failed (" + r.status + ")");
        });
      }
      return r.json().catch(function () { return {}; });
    });
  }

  function initForm() {
    const form = document.getElementById("waitlistForm");
    const status = document.getElementById("formStatus");
    if (!form || !status) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        name: (fd.get("name") || "").toString().trim(),
        vertical: fd.get("vertical") || "",
        role: (fd.get("role") || "").toString().trim(),
        availableDate: (fd.get("availableDate") || "").toString().trim(),
        goals: (fd.get("goals") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        linkedin: (fd.get("linkedin") || "").toString().trim(),
        company: (fd.get("company") || "").toString(), // honeypot — humans leave blank
        submittedAt: new Date().toISOString(),
      };

      if (!data.name || !data.vertical || !data.role || !data.availableDate) {
        setStatus(status, "Please add your name, vertical, role, and which dates work.", "err");
        return;
      }
      if (!data.email) {
        setStatus(status, "Please add your email so we can confirm your spot.", "err");
        return;
      }
      if (!isValidEmail(data.email)) {
        setStatus(status, "That email doesn't look right — mind checking it?", "err");
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = "Joining…"; }
      setStatus(status, "", null);

      submitSignup(data)
        .then(function () {
          form.reset();
          setStatus(
            status,
            "You're in, " + data.name.split(" ")[0] + ". We'll reach out about the next " +
              data.vertical + " coffee.",
            "ok"
          );
        })
        .catch(function () {
          setStatus(status, "Something went wrong on our end. Please try again in a moment.", "err");
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = "Join the waitlist"; }
        });
    });
  }

  function initYear() {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderThisWeek();
    renderVerticals();
    initForm();
    initYear();
  });
})();
