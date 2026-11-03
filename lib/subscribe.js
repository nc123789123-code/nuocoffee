/* Email signup for the Onlu Brief and event invites.
   Any <form data-subscribe> on the page gets wired up; rows go to the
   "Subscribers" tab of the Google Sheet via /api/waitlist (type "subscribe"). */
(function () {
  "use strict";
  var css =
    ".sub{border:1px solid rgba(46,224,208,.35);border-radius:18px;padding:clamp(18px,3vw,26px);background:linear-gradient(135deg,rgba(46,224,208,.09),rgba(255,79,154,.06));}" +
    ".sub h2,.sub h3{font-family:var(--font-display,var(--display));font-weight:600;font-size:1.15rem;letter-spacing:-.01em;margin:0 0 4px;}" +
    ".sub-lede{color:var(--muted);font-size:.95rem;margin:0 0 14px;}" +
    ".sub-row{display:flex;flex-wrap:wrap;gap:8px;}" +
    ".sub-row input{flex:1 1 200px;min-width:0;font:inherit;font-size:.95rem;color:var(--text);background:rgba(255,255,255,.05);border:1px solid rgba(150,200,230,.26);border-radius:999px;padding:11px 16px;}" +
    ".sub-row input::placeholder{color:var(--dim);}" +
    ".sub-row input:focus{outline:2px solid var(--tiffany);outline-offset:1px;border-color:transparent;}" +
    ".sub-row button{flex:none;font:inherit;font-weight:700;font-size:.92rem;color:#08131c;background:var(--grad);border:0;border-radius:999px;padding:11px 20px;cursor:pointer;}" +
    ".sub-row button:disabled{opacity:.6;cursor:default;}" +
    ".sub-opts{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:12px;font-size:.88rem;color:var(--muted);}" +
    ".sub-opts label{display:inline-flex;align-items:center;gap:8px;cursor:pointer;}" +
    ".sub-opts input{width:17px;height:17px;accent-color:var(--tiffany);}" +
    ".sub-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}" +
    ".sub-status{min-height:1.2em;margin:10px 0 0;font-size:.92rem;font-weight:600;}" +
    ".sub-status.ok{color:#6fe39a;}.sub-status.err{color:#ff7a8a;}" +
    ".sub-fine{color:var(--dim);font-size:.78rem;margin:6px 0 0;}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function wire(form) {
    var status = form.querySelector(".sub-status"), btn = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.email.value.trim();
      var topics = [form.news && form.news.checked ? "News" : "", form.events && form.events.checked ? "Events" : ""].filter(Boolean).join(", ");
      status.className = "sub-status";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status.textContent = "Please enter a valid email."; status.className += " err"; form.email.focus(); return; }
      if (!topics) { status.textContent = "Pick news, events or both."; status.className += " err"; return; }
      btn.disabled = true; status.textContent = "Subscribing…";
      fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subscribe", email: email, name: (form.fname && form.fname.value.trim()) || "",
                               topics: topics, company: form.company ? form.company.value : "", notes: "Signed up on " + location.pathname })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok) throw new Error((x.j && x.j.error) || "error");
          status.textContent = "You're subscribed. Check your inbox for a confirmation."; status.className += " ok";
          form.email.value = ""; if (form.fname) form.fname.value = "";
        })
        .catch(function () { status.textContent = "Something went wrong. Please try again, or email hello@onlu.ai."; status.className += " err"; })
        .then(function () { btn.disabled = false; });
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll("form[data-subscribe]"), wire);
})();
