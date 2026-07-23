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
     For now we persist locally and confirm. To go live, swap the
     body of submitSignup() for a POST to your form backend
     (Formspree, a serverless function, Airtable, etc.). */

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function saveLocally(entry) {
    try {
      const key = "cwo_waitlist";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push(entry);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {
      /* localStorage may be unavailable; non-fatal */
    }
  }

  function setStatus(el, msg, kind) {
    el.textContent = msg;
    el.className = "form__status" + (kind ? " form__status--" + kind : "");
  }

  function submitSignup(data) {
    // TODO: replace with a real backend call, e.g.:
    // return fetch("https://formspree.io/f/XXXX", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json", Accept: "application/json" },
    //   body: JSON.stringify(data),
    // }).then(function (r) { if (!r.ok) throw new Error("network"); });
    saveLocally(data);
    return Promise.resolve();
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
        email: (fd.get("email") || "").toString().trim(),
        vertical: fd.get("vertical") || "",
        seniority: fd.get("seniority") || "",
        neighborhood: fd.get("neighborhood") || "",
        submittedAt: new Date().toISOString(),
      };

      if (!data.name || !data.email || !data.vertical || !data.seniority || !data.neighborhood) {
        setStatus(status, "Please fill in every field so we can match you well.", "err");
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
            "You're on the list, " + data.name.split(" ")[0] + ". We'll reach out when a " +
              data.vertical + " group is forming near " + data.neighborhood + ".",
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
