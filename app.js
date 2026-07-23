/* ============================================================
   Coffee with Onlu — front-end behavior
   - Renders the vertical grid from a single source of truth
   - Handles waitlist submission (client-side for now)
   ============================================================ */

(function () {
  "use strict";

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
    renderVerticals();
    initForm();
    initYear();
  });
})();
