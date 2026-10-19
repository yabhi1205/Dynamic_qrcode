(function () {
  "use strict";

  var MAX_AMOUNT = 100000; // UPI per-transaction ceiling for most payments (₹1,00,000)
  var STORE_KEY = "upiqr.selected";

  var accounts = (window.UPI_CONFIG || []).filter(function (a) {
    return a && a.upi;
  });

  var el = {
    chips: document.getElementById("chips"),
    amount: document.getElementById("amount"),
    error: document.getElementById("error"),
    qrCard: document.getElementById("qrCard"),
    qr: document.getElementById("qr"),
    placeholder: document.getElementById("placeholder"),
    meta: document.getElementById("meta"),
    metaAmount: document.getElementById("metaAmount"),
    metaName: document.getElementById("metaName"),
    metaUpi: document.getElementById("metaUpi"),
    status: document.getElementById("status")
  };

  var selected = 0;
  try {
    var saved = parseInt(localStorage.getItem(STORE_KEY), 10);
    if (saved >= 0 && saved < accounts.length) selected = saved;
  } catch (e) { /* storage unavailable, use default */ }

  if (!accounts.length) {
    el.placeholder.textContent = "No UPI IDs configured. Add them in config.js.";
    el.amount.disabled = true;
    return;
  }

  // ── UPI IDs ────────────────────────────────────────────────
  function renderChips() {
    el.chips.innerHTML = "";
    accounts.forEach(function (a, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", i === selected ? "true" : "false");
      b.textContent = a.label || a.upi;
      b.addEventListener("click", function () {
        selected = i;
        try { localStorage.setItem(STORE_KEY, String(i)); } catch (e) {}
        renderChips();
        update();
      });
      el.chips.appendChild(b);
    });
  }

  // ── Amount handling ────────────────────────────────────────
  function sanitize(raw) {
    var s = raw.replace(/[^0-9.]/g, "");
    var dot = s.indexOf(".");
    if (dot !== -1) {
      s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
    }
    // drop leading zeros ("007" -> "7") but keep "0." and "0"
    s = s.replace(/^0+(?=\d)/, "");
    return s;
  }

  function formatINR(n) {
    return "₹" + n.toLocaleString("en-IN", {
      minimumFractionDigits: n % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  // ── UPI payment link ───────────────────────────────────────
  function buildUri(acc, amountStr) {
    var parts = [
      "pa=" + encodeURIComponent(acc.upi).replace(/%40/g, "@"),
      "pn=" + encodeURIComponent(acc.name || ""),
      "am=" + amountStr,
      "cu=INR"
    ];
    return "upi://pay?" + parts.join("&");
  }

  // ── Render ─────────────────────────────────────────────────
  function showEmpty(message) {
    el.qrCard.classList.add("empty");
    el.qr.innerHTML = "";
    el.meta.hidden = true;
    if (message) el.placeholder.textContent = message;
  }

  function showError(msg) {
    el.error.textContent = msg;
    el.error.hidden = !msg;
  }

  function update() {
    var acc = accounts[selected];
    var amountStr = el.amount.value;
    var n = parseFloat(amountStr);

    showError("");

    if (!amountStr || isNaN(n) || n <= 0) {
      showEmpty("Enter an amount to generate the QR");
      return;
    }
    if (n > MAX_AMOUNT) {
      showError("Maximum amount is " + formatINR(MAX_AMOUNT));
      showEmpty("Enter an amount to generate the QR");
      return;
    }

    // normalise to a clean decimal for the link (e.g. "12." -> "12", "5.5" -> "5.50")
    var clean = n.toFixed(2);

    var qr = qrcode(0, "M");
    qr.addData(buildUri(acc, clean));
    qr.make();
    el.qr.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    el.qrCard.classList.remove("empty");

    el.metaAmount.textContent = formatINR(n);
    el.metaName.textContent = acc.name || "";
    el.metaUpi.textContent = acc.upi;
    el.meta.hidden = false;
  }

  el.amount.addEventListener("input", function () {
    var s = sanitize(el.amount.value);
    if (s !== el.amount.value) el.amount.value = s;
    update();
  });

  renderChips();
  update();

  // ── Service worker (offline) ───────────────────────────────
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function () {
        return navigator.serviceWorker.ready;
      }).then(function () {
        el.status.hidden = false;
      }).catch(function () { /* offline mode unavailable (e.g. file://) */ });
    });
  }
})();
