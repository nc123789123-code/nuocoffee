/* ============================================================
   Coffee with Onlu — front-end behavior
   - Renders the vertical grid from a single source of truth
   - Handles waitlist submission (client-side for now)
   ============================================================ */

(function () {
  "use strict";

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
    if (n.indexOf("private equity") > -1) return { c: "var(--amber)", i: "🏛️" };
    if (n.indexOf("private credit") > -1) return { c: "var(--amber)", i: "🧾" };
    if (n.indexOf("banking") > -1)        return { c: "var(--pink)",  i: "🤝" };
    if (n.indexOf("quant") > -1)          return { c: "var(--mint)",  i: "🧠" };
    if (n.indexOf("public") > -1)         return { c: "var(--violet)", i: "📈" };
    return { c: "var(--amber)", i: "☕" };
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
          '<span class="tw-icon" aria-hidden="true">' + s.i + "</span>" +
        "</div>" +
        '<h2 class="tw-vertical">' + THIS_WEEK.vertical + "</h2>" +
        '<div class="tw-meta">' +
          (THIS_WEEK.date  ? "<span>🗓️ " + THIS_WEEK.date + "</span>" : "") +
          (THIS_WEEK.time  ? "<span>⏰ " + THIS_WEEK.time + "</span>" : "") +
          (THIS_WEEK.place ? "<span>📍 " + THIS_WEEK.place + "</span>" : "") +
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
    { icon: "🏛️", name: "Private Equity & Credit", desc: "Buyout and growth investing, direct lending, mezzanine, and special situations.", tag: "Private markets" },
    { icon: "🤝", name: "Investment Banking", desc: "M&A and coverage — analysts through MDs across advisory.", tag: "Sell side" },
    { icon: "🧠", name: "Quant / Systematic", desc: "Researchers and PMs in systematic and high-frequency strategies.", tag: "Systematic" },
    { icon: "📈", name: "Public Equity & Credit", desc: "Long/short and long-only equity, plus corporate, high-yield, and distressed credit.", tag: "Public markets" },
  ];

  function renderVerticals() {
    const grid = document.getElementById("verticalGrid");
    if (!grid) return;
    grid.innerHTML = VERTICALS.map(function (v) {
      return (
        '<article class="vert">' +
        '<span class="vert__tag">' + v.tag + "</span>" +
        '<div class="vert__icon" aria-hidden="true">' + v.icon + "</div>" +
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
        goals: (fd.get("goals") || "").toString().trim(),
        linkedin: (fd.get("linkedin") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        company: (fd.get("company") || "").toString(), // honeypot — humans leave blank
        submittedAt: new Date().toISOString(),
      };

      if (!data.name || !data.vertical || !data.role) {
        setStatus(status, "Please add your name, vertical, and role so we can seat you well.", "err");
        return;
      }
      if (!data.email && !data.linkedin) {
        setStatus(status, "Add your email or LinkedIn so we can confirm your spot.", "err");
        return;
      }
      if (data.email && !isValidEmail(data.email)) {
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
