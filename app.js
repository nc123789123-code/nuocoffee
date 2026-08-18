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
    dinner:    '<path d="M6 3v6a1.9 1.9 0 0 0 3.8 0V3"/><path d="M7.9 9v12"/><path d="M16.6 3c-1.4 0-2.4 1.9-2.4 4.6s1 3.9 2.4 3.9v9.5"/>',
  };

  function svg(name, cls) {
    var p = ICONS[name];
    if (!p) return "";
    return '<svg class="ico' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + p + "</svg>";
  }

  /* ============================================================
     UPCOMING COFFEES — edit this list. Add/remove/reorder events.
     Coffees run on weekends (Saturday or Sunday, morning or afternoon).
     `formVertical` should match a waitlist dropdown option.
     `time`  — e.g. "Saturday afternoon", "10:30 AM"
     `full`  — true once a table is full (shows a badge, RSVP = waitlist)
     Set EVENTS to [] to hide the upcoming section entirely.
     ============================================================ */
  const EVENTS = [
    {
      vertical: "Investment Banking",
      formVertical: "Investment Banking (M&A / Coverage)",
      iso: "2026-08-09",
      date: "Sunday, Aug 9",
      time: "Afternoon",
      place: "Midtown",
      note: "",
      full: false,
      partiful: "https://partiful.com/e/7NsXV90qdPXOfFBNf47k?c=NdK75lyX",
    },
    {
      title: "Finance Dinner",         // overrides the "<vertical> coffee" heading
      vertical: "Finance Dinner",
      formVertical: "Finance Dinner",
      iso: "2026-08-22",
      date: "Saturday, Aug 22",
      time: "6:00 PM",
      place: "West Chelsea restaurant",
      note: "Max 6 · dinner",
      full: false,
      partiful: "",  // add this dinner's Partiful link here
    },
    {
      vertical: "Public Credit & Equity",
      formVertical: "Public Credit & Equity",
      iso: "2026-08-30",
      date: "Sunday, Aug 30",
      time: "Afternoon",
      place: "Midtown",
      note: "",
      full: false,
      partiful: "",  // add this coffee's Partiful link here
    },
    {
      vertical: "Private Credit & Equity",
      formVertical: "Private Credit & Equity",
      iso: "2026-09-13",
      date: "Sunday, Sep 13",
      time: "Afternoon",
      place: "Midtown",
      note: "",
      full: false,
      partiful: "",  // add this coffee's Partiful link here
    },
  ];

  // Keep only events today or later (events without an `iso` always show).
  // "Today" is anchored to New York time so events stay listed through
  // the whole NYC day, not the UTC day.
  function upcomingEvents() {
    var todayISO = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    return EVENTS.filter(function (ev) { return !ev.iso || ev.iso >= todayISO; });
  }

  // Lookup by label, populated during render, used by the RSVP handler.
  var EVENT_INDEX = {};

  function eventLabel(ev) {
    return ev.vertical +
      (ev.date ? " · " + ev.date : "") +
      (ev.time ? " · " + ev.time : "") +
      (ev.place ? " · " + ev.place : "");
  }

  // Accent colour + icon per vertical, kept in sync with the grid below.
  function styleFor(name) {
    var n = (name || "").toLowerCase();
    if (n.indexOf("dinner") > -1 || n.indexOf("lunch") > -1) return { c: "var(--pink)",  i: "dinner" };
    if (n.indexOf("private equity") > -1) return { c: "var(--tiffany)", i: "bank" };
    if (n.indexOf("private credit") > -1) return { c: "var(--tiffany)", i: "receipt" };
    if (n.indexOf("banking") > -1)        return { c: "var(--tiffany-3)", i: "briefcase" };
    if (n.indexOf("quant") > -1)          return { c: "var(--mint)",  i: "cpu" };
    if (n.indexOf("public credit") > -1)  return { c: "var(--violet)", i: "percent" };
    if (n.indexOf("public") > -1)         return { c: "var(--violet)", i: "chart" };
    return { c: "var(--tiffany)", i: "coffee" };
  }

  // Move focus to the RSVP form with the given event pre-selected.
  function jumpToRsvp(label) {
    var sel = document.getElementById("rsvpEvent");
    if (sel && label) {
      for (var j = 0; j < sel.options.length; j++) {
        if (sel.options[j].value === label) { sel.selectedIndex = j; break; }
      }
    }
    var target = document.getElementById("rsvp");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    var nm = document.getElementById("rsvpName");
    if (nm) setTimeout(function () { nm.focus(); }, 500);
  }

  function renderUpcoming() {
    var section = document.getElementById("thisweek");
    var host = document.getElementById("thisweekInner");
    var rsvpSection = document.getElementById("rsvp");
    if (!section || !host) return;
    var events = upcomingEvents();
    if (!events.length) {
      section.hidden = true;
      if (rsvpSection) rsvpSection.hidden = true;
      return;
    }

    EVENT_INDEX = {};
    var cards = events.map(function (ev) {
      var s = styleFor(ev.formVertical || ev.vertical);
      var label = eventLabel(ev);
      EVENT_INDEX[label] = ev;
      var attr = encodeURIComponent(label);
      return (
        '<article class="tw-card" style="--tw:' + s.c + '">' +
          '<div class="tw-card__head">' +
            '<span class="tw-headleft"><span class="tw-pill"><span class="tw-dot"></span>' +
              (ev.full ? "Waitlist" : "Open") + "</span>" +
            (ev.full ? '<span class="tw-badge">Full</span>' : "") + "</span>" +
            '<span class="tw-icon" aria-hidden="true">' + svg(s.i) + "</span>" +
          "</div>" +
          '<h3 class="tw-vertical">' + (ev.title || (ev.vertical + " coffee")) + "</h3>" +
          '<div class="tw-meta">' +
            (ev.date  ? "<span>" + svg("calendar") + ev.date + "</span>" : "") +
            (ev.time  ? "<span>" + svg("clock") + ev.time + "</span>" : "") +
            (ev.place ? "<span>" + svg("pin") + ev.place + "</span>" : "") +
          "</div>" +
          '<div class="tw-foot">' +
            (ev.note ? '<span class="tw-note">' + ev.note + "</span>" : "<span></span>") +
            '<span class="tw-actions">' +
              '<button class="btn tw-rsvp" type="button" data-label="' + attr + '">' +
                (ev.full ? "Join waitlist →" : "RSVP →") + "</button>" +
              (ev.partiful
                ? '<a class="tw-partiful" href="' + ev.partiful.replace(/"/g, "&quot;") +
                  '" target="_blank" rel="noopener">See it on Partiful ↗</a>'
                : "") +
            "</span>" +
          "</div>" +
        "</article>"
      );
    }).join("");

    host.innerHTML =
      '<p class="eyebrow eyebrow--center">Upcoming</p>' +
      '<h2 class="section__title">Pull up a chair.</h2>' +
      '<p class="section__lede">Coffees and dinners in NYC — always small groups of 4–6, however many show up. Grab a seat.</p>' +
      '<div class="tw-list">' + cards + "</div>";
    section.hidden = false;

    // Populate the RSVP event dropdown.
    var sel = document.getElementById("rsvpEvent");
    if (sel) {
      var opts = '<option value="" disabled selected>Choose a coffee…</option>';
      events.forEach(function (ev) {
        var label = eventLabel(ev);
        var text = label.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        opts += '<option value="' + label.replace(/"/g, "&quot;") + '">' +
          text + (ev.full ? " — full (waitlist)" : "") + "</option>";
      });
      sel.innerHTML = opts;
    }
    if (rsvpSection) rsvpSection.hidden = false;

    // Wire each card's internal button (not the Partiful links) to the RSVP form.
    var btns = host.querySelectorAll("button.tw-rsvp");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        jumpToRsvp(decodeURIComponent(this.getAttribute("data-label")));
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
        type: "waitlist",
        name: (fd.get("name") || "").toString().trim(),
        vertical: fd.get("vertical") || "",
        role: (fd.get("role") || "").toString().trim(),
        availableDate: (fd.get("availableDate") || "").toString().trim(),
        goals: (fd.get("goals") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        linkedin: (fd.get("linkedin") || "").toString().trim(),
        instagram: (fd.get("instagram") || "").toString().trim(),
        wechat: (fd.get("wechat") || "").toString().trim(),
        mbti: (fd.get("mbti") || "").toString().trim(),
        topics: (fd.get("topics") || "").toString().trim(),
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
          if (btn) { btn.disabled = false; btn.textContent = "Save my spot"; }
        });
    });
  }

  /* ---- RSVP form (event-specific, separate from the waitlist) ---- */
  function initRsvp() {
    const form = document.getElementById("rsvpForm");
    const status = document.getElementById("rsvpStatus");
    if (!form || !status) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const fd = new FormData(form);
      const eventVal = (fd.get("event") || "").toString();
      const ev = EVENT_INDEX[eventVal];
      const data = {
        type: "rsvp",
        event: eventVal,
        name: (fd.get("name") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        instagram: (fd.get("instagram") || "").toString().trim(),
        wechat: (fd.get("wechat") || "").toString().trim(),
        mbti: (fd.get("mbti") || "").toString().trim(),
        topics: (fd.get("topics") || "").toString().trim(),
        notes: (fd.get("notes") || "").toString().trim(),
        // stable tab name for this coffee (unaffected by time/venue edits)
        eventTab: ev ? (ev.vertical + " · " + ev.date) : "RSVP",
        // carried from the chosen event so RSVPs are sortable like waitlist rows
        vertical: ev ? (ev.formVertical || ev.vertical || "") : "",
        availableDate: ev ? (ev.date || "") : "",
        company: (fd.get("company") || "").toString(), // honeypot
        submittedAt: new Date().toISOString(),
      };

      if (!data.event) {
        setStatus(status, "Please choose which coffee you'd like to join.", "err");
        return;
      }
      if (!data.name) {
        setStatus(status, "Please add your name.", "err");
        return;
      }
      if (!data.email || !isValidEmail(data.email)) {
        setStatus(status, "Please add a valid email so we can send you the details.", "err");
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      setStatus(status, "", null);

      submitSignup(data)
        .then(function () {
          form.reset();
          setStatus(status, "You're in, " + data.name.split(" ")[0] + " — we'll email you the details.", "ok");
        })
        .catch(function () {
          setStatus(status, "Something went wrong on our end. Please try again in a moment.", "err");
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = "Confirm RSVP"; }
        });
    });
  }

  function initYear() {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderUpcoming();
    renderVerticals();
    initForm();
    initRsvp();
    initYear();
  });
})();
