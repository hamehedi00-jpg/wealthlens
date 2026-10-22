(function () {
  "use strict";
  var C = window.CONFIG, L = window.I18N;

  // ---------- state ----------
  var S = {
    lang: "bn",
    shariah: false,
    tab: "compare",
    cmp: { mode: "lump", lump: 500000, monthly: 5000, years: 5, bracket: 0.10, risk: "low", early: false, exitM: 12 },
    goal: { preset: "edu", target: 1000000, years: 10, inflate: true },
    tax: { income: 900000, salaried: true, special: false, invested: 0 },
    biz: { amount: 2000000, months: 6, place: "current" },
    summary: ""
  };
  try {
    var saved = localStorage.getItem("sanchay-lang");
    if (saved === "en" || saved === "bn") S.lang = saved;
  } catch (e) {}
  if (/[?&]lang=en/.test(location.search)) S.lang = "en";
  var h = (location.hash || "").replace("#", "");
  if (["compare", "goal", "tax", "biz", "guide"].indexOf(h) >= 0) S.tab = h;

  // ---------- text helpers ----------
  // With English digits chosen, Bangla digits inside the wording are shown as English too
  function fixDigits(v) {
    if (S.lang !== "bn" || C.banglaDigits) return v;
    if (typeof v === "string") return v.replace(/[০-৯]/g, function (d) { return String("০১২৩৪৫৬৭৮৯".indexOf(d)); });
    if (Array.isArray(v)) return v.map(fixDigits);
    if (v && typeof v === "object") { var o = {}; Object.keys(v).forEach(function (k) { o[k] = fixDigits(v[k]); }); return o; }
    return v;
  }
  function t(key, vars) {
    var s = L[S.lang][key];
    if (s === undefined) s = L.bn[key];
    if (s === undefined) return key;
    s = fixDigits(s);
    if (typeof s !== "string") return s;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  var BN_DIGITS = "০১২৩৪৫৬৭৮৯";
  function digits(str) {
    str = String(str);
    if (S.lang !== "bn" || !C.banglaDigits) return str;
    return str.replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }
  function toLatin(str) {
    return String(str).replace(/[০-৯]/g, function (d) { return String(BN_DIGITS.indexOf(d)); });
  }
  function parseNum(str) {
    var n = parseInt(toLatin(str).replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }
  // Indian/Bangla grouping: 12,34,567
  function group(n) {
    n = Math.round(Math.abs(n));
    var s = String(n);
    if (s.length <= 3) return s;
    var last3 = s.slice(-3), rest = s.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  function tk(n) { return (n < 0 ? "-" : "") + "৳" + digits(group(n)); }
  function pct(x) { return digits(String(Math.round(x * 100) / 100)); }
  function words(n) {
    n = Math.round(n);
    if (n >= 1e7) return digits(trim(n / 1e7)) + " " + t("crore");
    if (n >= 1e5) return digits(trim(n / 1e5)) + " " + t("lakh");
    if (n >= 1e3) return digits(trim(n / 1e3)) + " " + t("thousand");
    return digits(String(n));
  }
  function trim(x) { return String(Math.round(x * 100) / 100); }
  function short(n) { return "৳" + words(n); }
  // Easy-to-read money for sentences: ৳8.64 লাখ, ৳72,500
  function easy(n) {
    n = Math.round(n);
    if (n >= 1e7) return "৳" + digits((n / 1e7).toFixed(2)) + " " + t("crore");
    if (n >= 1e5) return "৳" + digits((n / 1e5).toFixed(2)) + " " + t("lakh");
    return tk(Math.round(n / 100) * 100);
  }
  function easyRange(a, b) {
    var x = Math.min(a, b), y = Math.max(a, b), ex = easy(x), ey = easy(y);
    if (ex === ey) return ex;
    var unit = y >= 1e7 ? t("crore") : y >= 1e5 ? t("lakh") : "";
    if (unit && x >= (y >= 1e7 ? 1e7 : 1e5)) return ex.replace(" " + unit, "") + "–" + ey.replace("৳", "");
    return ex + " – " + ey;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- money maths ----------
  var T = C.tax;
  function interestTax(bracket) { return Math.max(bracket, T.interestTDS); }

  // Value after `e` months of a one-time amount P.
  // opts.noTax: ignore tax; opts.noPenalty: pretend the money stayed to term (used to show the cost of breaking early)
  function lumpValue(id, P, totalM, e, bracket, rateKey, opts) {
    opts = opts || {};
    var ins = C.instruments[id], ti = opts.noTax ? 0 : interestTax(bracket);
    if (ins.kind === "fdr") {
      var r = ins.rate / 100, k = Math.floor(e / 12), rem = e - 12 * k;
      var v = P * Math.pow(1 + r * (1 - ti), k);
      if (rem > 0) v += v * ((opts.noPenalty ? ins.rate : ins.breakRate) / 100) * (1 - ti) * rem / 12;
      return v;
    }
    if (ins.kind === "sanchay") {
      var rate = (P > ins.tierLimit ? ins.rateHigh : ins.rate) / 100;
      var term = ins.termYears * 12, cycles = Math.floor(e / term), inCycle = e - cycles * term;
      var yrs = Math.floor(inCycle / 12);
      var partRate = opts.noPenalty ? rate * inCycle / 12 : (ins.earlyRates[yrs] / 100) * yrs;
      // profit is paid out every 3 months and spent/kept aside, so it is NOT compounded
      var profit = P * (rate * ins.termYears * cycles + partRate);
      return P + profit * (1 - ti);
    }
    if (ins.kind === "fund") {
      var fr = ins[rateKey || "low"] / 100;
      var g = P * Math.pow(1 + fr, e / 12) - P;
      return P + g * (1 - (opts.noTax ? 0 : T.fundGainTax));
    }
    return P;
  }
  // Value after `e` months of paying m every month, plan length totalM
  function monthlyValue(id, m, totalM, e, bracket, rateKey, opts) {
    opts = opts || {};
    var ins = C.instruments[id], ti = opts.noTax ? 0 : interestTax(bracket), paid = m * e;
    if (ins.kind === "dps") {
      var rate;
      if (e >= totalM || opts.noPenalty) rate = ins.rate;
      else if (e < ins.noProfitBeforeMonths) return paid;
      else rate = ins.breakRate;
      var i = rate / 1200;
      var fv = m * (Math.pow(1 + i, e) - 1) / i * (1 + i);
      return paid + (fv - paid) * (1 - ti);
    }
    if (ins.kind === "fund") {
      var j = Math.pow(1 + ins[rateKey || "low"] / 100, 1 / 12) - 1;
      var fv2 = m * (Math.pow(1 + j, e) - 1) / j * (1 + j);
      return paid + (fv2 - paid) * (1 - (opts.noTax ? 0 : T.fundGainTax));
    }
    return paid;
  }
  // Yearly bank excise duty on the account balance
  function exciseFor(balance) {
    var fee = 0;
    C.excise.forEach(function (sl) { if (balance > sl[0]) fee = sl[1]; });
    return fee;
  }
  // Full picture for one option: value after all costs, and what each cost took away
  function outcome(id, monthly, amt, totalM, e, bracket, rateKey) {
    var ins = C.instruments[id], f = monthly ? monthlyValue : lumpValue;
    var value = f(id, amt, totalM, e, bracket, rateKey);
    var noTax = f(id, amt, totalM, e, bracket, rateKey, { noTax: true });
    var noPen = f(id, amt, totalM, e, bracket, rateKey, { noPenalty: true });
    var excise = 0;
    if (ins.kind === "fdr" || ins.kind === "dps") {
      for (var y = 1; y <= Math.ceil(e / 12); y++) {
        var mth = Math.min(12 * y, e);
        var bal = monthly ? monthlyValue(id, amt, mth, mth, bracket, rateKey, { noTax: true }) : lumpValue(id, amt, totalM, mth, bracket, rateKey, { noTax: true, noPenalty: true });
        excise += exciseFor(bal);
      }
    }
    var paid = monthly ? amt * e : amt;
    var net = value - excise;
    // only count a break cost when the person withdraws before the end of their own plan
    var penalty = e < totalM ? Math.max(0, noPen - value) : 0;
    return { value: net, tax: noTax - value, excise: excise, penalty: penalty, paid: paid,
      real: net / Math.pow(1 + C.inflation / 100, e / 12), eff: effRate(monthly, amt, e, net) };
  }
  // Yearly return actually earned, after every cost
  function effRate(monthly, amt, e, value) {
    if (e <= 0 || amt <= 0) return 0;
    if (!monthly) return Math.pow(value / amt, 12 / e) - 1;
    var lo = -0.5, hi = 1;
    for (var k = 0; k < 60; k++) {
      var mid = (lo + hi) / 2, j = Math.pow(1 + mid, 1 / 12) - 1;
      var fv = Math.abs(j) < 1e-9 ? amt * e : amt * (Math.pow(1 + j, e) - 1) / j * (1 + j);
      if (fv > value) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }
  function visibleIds(mode) {
    return C.order.filter(function (id) {
      var ins = C.instruments[id];
      if (mode && ins.modes.indexOf(mode) < 0) return false;
      return S.shariah ? ins.shariah : (id !== "mtd" && id !== "mdps");
    });
  }

  // ---------- tax maths ----------
  function slabTax(taxable, threshold) {
    var rest = taxable - threshold, tax = 0;
    for (var i = 0; i < T.slabs.length && rest > 0; i++) {
      var w = Math.min(rest, T.slabs[i][0]);
      tax += w * T.slabs[i][1];
      rest -= w;
    }
    return tax;
  }
  function taxCalc(st) {
    var income = st.income;
    var taxable = st.salaried ? income - Math.min(income * T.salaryExclusion.fraction, T.salaryExclusion.cap) : income;
    var threshold = st.special ? T.thresholdWomenSenior : T.thresholdGeneral;
    var gross = slabTax(taxable, threshold);
    var above = taxable > threshold;
    if (above) gross = Math.max(gross, T.minTax);
    var maxRebateRule = Math.min(taxable * T.rebate.incomePct, T.rebate.cap);
    var floor = above ? T.minTax : 0;
    var maxUsable = Math.max(0, Math.min(maxRebateRule, gross - floor));
    var needInvest = maxUsable / T.rebate.investPct;
    var currentRebate = Math.min(st.invested * T.rebate.investPct, maxUsable);
    var remaining = Math.max(0, needInvest - st.invested);
    return { taxable: taxable, gross: gross, above: above, maxRebate: maxUsable, needInvest: needInvest,
      currentRebate: currentRebate, remaining: remaining, after: gross - maxUsable };
  }
  function monthsToJune() {
    var d = new Date(), m = d.getMonth(), y = d.getFullYear();
    var endY = m >= 6 ? y + 1 : y;
    return Math.max(1, (endY - y) * 12 + (5 - m) + 1);
  }

  // ---------- DOM helpers ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var panel = $("#panel");

  function applyStatic() {
    document.documentElement.lang = S.lang;
    document.title = t("pageTitle");
    $$("[data-i]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i")); });
    $("#heroTitle").innerHTML = t("heroTitle");
    $$("[data-i-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-i-aria"))); });
    $("#langBtn").textContent = t("langSwitch");
    var a = C.advisor;
    $("#advisorName").textContent = S.lang === "bn" ? a.nameBn : a.nameEn;
    $("#advisorRole").textContent = S.lang === "bn" ? a.titleBn : a.titleEn;
    $("#advisorCo").textContent = S.lang === "bn" ? a.companyBn : a.companyEn;
    $("#advHelp").innerHTML = t("advHelp").map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("");
    $("#advWa").href = a.whatsappContact || ("https://wa.me/" + a.whatsapp + "?text=" + encodeURIComponent(t("waHello")));
    if (a.facebook) { $("#advFb").href = a.facebook; $("#advFb").hidden = false; }
    paintQr($("#advQr"));
    var d = new Date(C.lastUpdated + "T00:00:00");
    var dateStr = d.toLocaleDateString(S.lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
    $("#sourcesLine").textContent = t("sourcesLine", { date: fixDigits(dateStr) });
    $$(".tabs button").forEach(function (b) {
      var on = b.getAttribute("data-tab") === S.tab;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    $("#shariah").checked = S.shariah;
    $("#shariahNote").hidden = !S.shariah;
  }

  function moneyField(id, label, value, chips, help) {
    return '<div class="field"><label for="' + id + '">' + label + '</label>' +
      '<div class="money"><input type="text" inputmode="numeric" id="' + id + '" value="' + digits(group(value)) + '" autocomplete="off"></div>' +
      '<div class="in-words" id="' + id + '-w">= ' + short(value) + '</div>' +
      (chips ? '<div class="chips">' + chips.map(function (c) {
        return '<button type="button" class="chip" data-set="' + id + '" data-val="' + c + '">' + short(c) + '</button>';
      }).join("") + '</div>' : "") +
      (help ? '<p class="help">' + help + '</p>' : "") + '</div>';
  }
  function rangeField(id, label, min, max, value, fmtKey) {
    return '<div class="field"><div class="range-row"><label for="' + id + '">' + label + '</label>' +
      '<span class="range-val" id="' + id + '-v">' + t(fmtKey, { n: digits(value), m: digits(value) }) + '</span></div>' +
      '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="1" value="' + value + '"></div>';
  }
  function tagsFor(id) {
    var ins = C.instruments[id], out = [];
    out.push('<span' + (ins.risk > 1 ? ' class="r2"' : "") + '>' + t("risk" + ins.risk) + '</span>');
    out.push('<span>' + t(ins.kind === "fund" ? "liq_fund" : "liq_" + ins.kind) + '</span>');
    if (ins.rebate) out.push('<span class="hi">' + t("tagRebate") + '</span>');
    if (ins.shariah) out.push('<span class="hi">' + t("tagShariah") + '</span>');
    else if (ins.kind !== "fund") out.push('<span>' + t("tagInterest") + '</span>');
    return '<div class="facts">' + out.join("") + '</div>';
  }
  function rateNote(id, amount) {
    var ins = C.instruments[id];
    if (ins.kind === "fund") return t("fundRange", { low: pct(ins.low), high: pct(ins.high) });
    var r = ins.kind === "sanchay" && amount > ins.tierLimit ? ins.rateHigh : ins.rate;
    return t("fixedRate", { rate: pct(r) }) + (ins.kind === "sanchay" ? " · " + t("sanchayNote") : "");
  }

  // ---------- TAB: compare ----------
  function renderCompare() {
    var c = S.cmp;
    var lump = c.mode === "lump";
    var BR = [0.15, 0.10, 0.10, 0.15, 0.20, 0.25, 0.30];
    var brackets = BR.map(function (v, i) { return [v, i === 0 ? t("bracketNoTin") : i === 1 ? t("bracketNone") : digits(Math.round(v * 100)) + "%"]; });
    panel.innerHTML =
      '<div class="card"><div class="form">' +
      '<div class="field"><span class="label">' + t("howLabel") + '</span><div class="choice">' +
      '<button type="button" data-mode="lump" aria-pressed="' + lump + '"><strong>' + t("lumpTitle") + '</strong><span>' + t("lumpSub") + '</span></button>' +
      '<button type="button" data-mode="monthly" aria-pressed="' + !lump + '"><strong>' + t("monthlyTitle") + '</strong><span>' + t("monthlySub") + '</span></button>' +
      '</div></div>' +
      (lump ? moneyField("cmpAmt", t("amountLump"), c.lump, [100000, 500000, 1000000, 2500000])
            : moneyField("cmpAmt", t("amountMonthly"), c.monthly, [1000, 3000, 5000, 10000, 25000])) +
      rangeField("cmpYears", t("yearsLabel"), 1, 15, c.years, "yearsVal") +
      '<div class="field"><label for="cmpBracket">' + t("bracketLabel") + '</label><select id="cmpBracket">' +
      brackets.map(function (b, i) {
        var label = b[1];
        var sel = (c.bracketIdx === undefined ? 2 : c.bracketIdx) === i ? " selected" : "";
        return '<option value="' + i + '"' + sel + '>' + label + '</option>';
      }).join("") + '</select><p class="help">' + t("bracketHelp") + '</p></div>' +
      '<div class="field"><span class="label">' + t("riskLabel") + '</span><div class="choice three">' +
      ["low", "mod", "high"].map(function (r) {
        return '<button type="button" data-risk="' + r + '" aria-pressed="' + (c.risk === r) + '"><strong>' + t("rk_" + r) + '</strong><span>' + t("rk_" + r + "_sub") + '</span></button>';
      }).join("") + '</div><p class="help">' + t("riskHelp") + '</p></div>' +
      '<label class="check" for="cmpEarly"><input type="checkbox" id="cmpEarly"' + (c.early ? " checked" : "") + '><span>' + t("earlyLabel") + '</span></label>' +
      '<div id="earlyWrap"' + (c.early ? "" : " hidden") + '>' + rangeField("cmpExit", "", 1, Math.max(1, c.years * 12 - 1), Math.min(c.exitM, c.years * 12 - 1), "earlyWhen") + '</div>' +
      '</div></div>' +
      '<div class="card" id="cmpOut"></div>';
    bindCompare();
    renderCompareResults();
  }
  function bindCompare() {
    $$("[data-mode]", panel).forEach(function (b) {
      b.addEventListener("click", function () { S.cmp.mode = b.getAttribute("data-mode"); renderCompare(); });
    });
    $$("[data-risk]", panel).forEach(function (b) {
      b.addEventListener("click", function () {
        S.cmp.risk = b.getAttribute("data-risk");
        $$("[data-risk]", panel).forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        renderCompareResults();
      });
    });
    bindMoney("cmpAmt", function (v) { if (S.cmp.mode === "lump") S.cmp.lump = v; else S.cmp.monthly = v; renderCompareResults(); });
    $("#cmpYears").addEventListener("input", function (e) {
      S.cmp.years = +e.target.value;
      $("#cmpYears-v").textContent = t("yearsVal", { n: digits(S.cmp.years) });
      var ex = $("#cmpExit"), mx = Math.max(1, S.cmp.years * 12 - 1);
      ex.max = mx; if (S.cmp.exitM > mx) { S.cmp.exitM = mx; ex.value = mx; }
      $("#cmpExit-v").textContent = t("earlyWhen", { m: digits(S.cmp.exitM) });
      renderCompareResults();
    });
    $("#cmpBracket").addEventListener("change", function (e) {
      var i = +e.target.value; S.cmp.bracketIdx = i;
      S.cmp.bracket = [0.15, 0.10, 0.10, 0.15, 0.20, 0.25, 0.30][i]; renderCompareResults();
    });
    $("#cmpEarly").addEventListener("change", function (e) { S.cmp.early = e.target.checked; $("#earlyWrap").hidden = !S.cmp.early; renderCompareResults(); });
    $("#cmpExit").addEventListener("input", function (e) {
      S.cmp.exitM = +e.target.value; $("#cmpExit-v").textContent = t("earlyWhen", { m: digits(S.cmp.exitM) }); renderCompareResults();
    });
  }
  function compareData() {
    var c = S.cmp, lump = c.mode === "lump", amt = lump ? c.lump : c.monthly;
    var total = c.years * 12, e = c.early ? Math.min(c.exitM, total - 1) : total;
    var paid = lump ? amt : amt * e;
    var rows = visibleIds(c.mode).map(function (id) {
      var ins = C.instruments[id], fund = ins.kind === "fund";
      var oLo = outcome(id, !lump, amt, total, e, c.bracket, "low");
      var oHi = fund ? outcome(id, !lump, amt, total, e, c.bracket, "high") : oLo;
      return { id: id, lo: oLo.value, hi: oHi.value, mid: (oLo.value + oHi.value) / 2, fund: fund, oLo: oLo, oHi: oHi };
    });
    rows.sort(function (a, b) { return b.mid - a.mid; });
    return { rows: rows, paid: paid, amt: amt, e: e, total: total, lump: lump };
  }
  function suggestion(d) {
    var c = S.cmp, byId = {};
    d.rows.forEach(function (r) { byId[r.id] = r; });
    if (S.shariah) {
      if (c.risk === "low") return { id: d.lump ? "mtd" : "mdps", text: t("sug_shariahSafe") };
      return { id: "sasf", text: t("sug_shariahGrowth") };
    }
    if (c.early) return { id: "sfif", text: t("sug_sfifEarly") };
    if (c.risk === "high" && c.years >= 2) return { id: "sfiuf", text: t("sug_high") };
    if (c.risk === "mod" && c.years >= 3) return { id: "sfiuf", text: t("sug_growth") };
    if (c.risk === "low") {
      var fixed = d.rows.filter(function (r) { return !r.fund; }).sort(function (a, b) { return b.lo - a.lo; })[0];
      if (fixed && byId.sfif && fixed.lo > byId.sfif.lo) return { id: fixed.id, text: t("sug_fixedWins", { name: t("name_" + fixed.id) }) };
      return { id: "sfif", text: t("sug_sfifSafe") };
    }
    return { id: "sfif", text: t("sug_shortTerm") };
  }
  function barsHtml(rows, paid, bestId, amountForRate) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.hi; }).concat([paid])) * 1.02;
    return '<div class="rows">' + rows.map(function (r, i) {
      var lowW = r.lo / max * 100, hiW = r.hi / max * 100, depW = paid / max * 100;
      var val = r.fund ? tk(r.lo) + ' – ' + tk(r.hi) : tk(r.lo);
      return '<div class="row' + (r.id === bestId ? " best" : "") + '">' +
        '<span class="rank num" aria-hidden="true">' + digits(i + 1) + '</span>' +
        '<div class="row-top"><span class="row-name" data-best="' + esc(t("bestBadge")) + '">' + t("name_" + r.id) + '<span class="rate">' + rateNote(r.id, amountForRate) + '</span></span>' +
        '<span class="row-val num">' + val + '</span></div>' +
        '<div class="bar" role="img" aria-label="' + esc(t("name_" + r.id) + " " + val) + '">' +
        '<div class="fill" style="width:' + lowW.toFixed(2) + '%"></div>' +
        (r.fund ? '<div class="span" style="left:' + lowW.toFixed(2) + '%;width:' + (hiW - lowW).toFixed(2) + '%"></div>' : "") +
        '<div class="dep" style="left:' + depW.toFixed(2) + '%"></div></div>' +
        '<div class="gainline num">' + t("profit") + ': ' + (r.fund ? tk(r.lo - paid) + ' – ' + tk(r.hi - paid) + ' · ' + t("estimate") : tk(r.lo - paid)) + '</div>' +
        costsHtml(r) + tagsFor(r.id) + '</div>';
    }).join("") + '</div>';
  }
  function rng(a, b, fmt) { var x = fmt(Math.min(a, b)), y = fmt(Math.max(a, b)); return x === y ? x : x + '–' + y; }
  function pctTxt(x) { return digits((Math.round(x * 1000) / 10).toFixed(1)) + "%"; }
  function costsHtml(r) {
    var lo = r.oLo, hi = r.oHi, items = [];
    items.push(['<span class="k">' + t("c_eff") + '</span><span class="v num">' + rng(lo.eff, hi.eff, pctTxt) + '</span>', ""]);
    if (Math.round(hi.tax) > 0) items.push(['<span class="k">' + (r.fund ? t("c_taxFund") : t("c_tax")) + '</span><span class="v num">−' + rng(lo.tax, hi.tax, tk) + '</span>', "neg"]);
    if (lo.excise > 0) items.push(['<span class="k">' + t("c_excise") + '</span><span class="v num">−' + tk(lo.excise) + '</span>', "neg"]);
    if (Math.round(lo.penalty) > 0) items.push(['<span class="k">' + t("c_penalty") + '</span><span class="v num">−' + tk(lo.penalty) + '</span>', "neg"]);
    else if (r.fund && S.cmp.early) items.push(['<span class="k">' + t("c_penalty") + '</span><span class="v">' + t("c_none") + '</span>', "pos"]);
    return '<div class="costs">' + items.map(function (it) { return '<div class="cost ' + it[1] + '">' + it[0] + '</div>'; }).join("") + '</div>';
  }
  // Low-risk answers: show what a moderate-risk fund could add, so the person sees the trade-off
  function upsideCard(d, sug) {
    var c = S.cmp;
    if (c.risk !== "low" || c.early || c.years < 3) return "";
    var altId = S.shariah ? "sasf" : "sfiuf";
    if (sug.id === altId) return "";
    var alt = d.rows.filter(function (x) { return x.id === altId; })[0];
    var base = d.rows.filter(function (x) { return x.id === sug.id; })[0];
    if (!alt || !base) return "";
    var a = alt.lo - base.lo, b = alt.hi - base.lo;
    if (b <= 0) return "";
    return '<div class="upside glass"><p class="k">' + t("up_head") + '</p>' +
      '<p class="name">' + t("name_" + altId) + '</p>' +
      '<p class="num">' + t("up_line", { years: digits(c.years), val: easyRange(alt.lo, alt.hi), more: a > 0 ? easyRange(a, b) : easy(b), base: t("short_" + sug.id) }) + '</p>' +
      '<p class="help">' + t("up_caveat") + '</p>' +
      '<button type="button" class="btn ghost small" data-try-mod>' + t("up_btn") + '</button></div>';
  }
  function beatLine(d, best) {
    var baseId = d.lump ? (S.shariah ? "mtd" : "fdr") : (S.shariah ? "mdps" : "dps");
    if (!best || best.id === baseId) return "";
    var base = d.rows.filter(function (x) { return x.id === baseId; })[0];
    if (!base) return "";
    var a = best.lo - base.lo, b = best.hi - base.lo;
    if (b <= 0) return "";
    return '<p class="beat num">' + t("beat", { name: t("short_" + baseId), amt: a > 0 ? easyRange(a, b) : easy(b) }) + '</p>';
  }
  function whyLow(d) {
    var id = d.lump ? (S.shariah ? "mtd" : "fdr") : (S.shariah ? "mdps" : "dps");
    var r = d.rows.filter(function (x) { return x.id === id; })[0];
    if (!r) return "";
    var o = r.oLo, ins = C.instruments[id];
    var real = (1 + o.eff) / (1 + C.inflation / 100) - 1;
    var cost = o.tax + o.excise + o.penalty;
    return '<div class="callout warn why-low"><p class="k">' + t("why_head", { name: t("short_" + id) }) + '</p><p>' +
      t("why_body", { rate: pctTxt(ins.rate / 100), eff: pctTxt(o.eff), cost: tk(cost), inf: digits(C.inflation), real: pctTxt(real) }) + '</p></div>';
  }
  function renderCompareResults() {
    var c = S.cmp, d = compareData(), out = $("#cmpOut");
    var sug = suggestion(d);
    var head = c.early ? t("resultHeadEarly", { m: digits(d.e) }) : t("resultHead", { years: digits(c.years) });
    S.summary = d.lump ? t("sumLump", { amount: tk(d.amt), years: digits(c.years) }) : t("sumMonthly", { amount: tk(d.amt), years: digits(c.years) });
    S.lastCard = { type: "compare", data: d };
    var best = d.rows.filter(function (r) { return r.id === sug.id; })[0];
    var bestFig = best ? (best.fund ? tk(best.lo) + ' – ' + tk(best.hi) : tk(best.lo)) : "";
    out.innerHTML =
      '<div class="verdict"><p class="k">' + t("suggestHead") + '</p><p class="name">' + t("name_" + sug.id) + '</p>' +
      (best ? '<p class="why">' + (c.early ? t("verdictFigEarly", { m: digits(d.e) }) : t("verdictFig", { years: digits(c.years) })) + '</p><p class="fig num">' + bestFig + '</p>' : "") +
      beatLine(d, best) +
      '<p class="why">' + sug.text + '</p></div>' +
      upsideCard(d, sug) +
      '<div class="results-head" style="margin-top:22px"><h2>' + head + '</h2><span class="sub">' + t("afterTax") + '</span></div>' +
      '<p class="paidline">' + t("deposited") + ': <strong class="num">' + tk(d.paid) + '</strong></p>' +
      '<div class="legend"><span><i class="lg-fixed"></i>' + (S.lang === "bn" ? "নির্দিষ্ট হার" : "Fixed rate") + '</span>' +
      '<span><i class="lg-range"></i>' + (S.lang === "bn" ? "ফান্ডের সম্ভাব্য সীমা" : "Fund estimate range") + '</span>' +
      '<span><i class="lg-dep"></i>' + t("principalMark") + '</span></div>' +
      barsHtml(d.rows, d.paid, sug.id, d.amt) +
      whyLow(d) +
      (S.shariah ? "" : '<p class="note">' + (d.lump ? t("notForLump") : t("notForMonthly")) + '</p>') +
      '<div class="actions"><button type="button" class="btn primary" data-share>' + t("shareBtn") + '</button>' +
      '<a class="btn ghost" data-wa target="_blank" rel="noopener" href="' + waLink() + '">' + t("talkBtn") + '</a></div>';
    bindResultActions(out);
    var tm = $("[data-try-mod]", out);
    if (tm) tm.addEventListener("click", function () {
      S.cmp.risk = "mod";
      $$("[data-risk]", panel).forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-risk") === "mod"); });
      renderCompareResults();
    });
    updateFab();
  }

  // ---------- TAB: goal ----------
  var GOALS = ["edu", "wedding", "hajj", "umrah", "home", "retire", "emergency", "custom"];
  function renderGoal() {
    var g = S.goal;
    panel.innerHTML =
      '<div class="card"><div class="form">' +
      '<div class="field"><span class="label">' + t("goalPick") + '</span><div class="chips">' +
      GOALS.map(function (k) { return '<button type="button" class="chip" data-goal="' + k + '" aria-pressed="' + (g.preset === k) + '">' + t("goal_" + k) + '</button>'; }).join("") +
      '</div></div>' +
      moneyField("goalAmt", t("goalAmount"), g.target, null) +
      rangeField("goalYears", t("goalYears"), 1, 25, g.years, "yearsVal") +
      '<label class="check" for="goalInf"><input type="checkbox" id="goalInf"' + (g.inflate ? " checked" : "") + '><span>' + t("goalInflate", { inf: digits(C.inflation) }) + '</span></label>' +
      '<p class="help" id="goalInfNote"></p>' +
      '</div></div><div class="card" id="goalOut"></div>';
    $$("[data-goal]", panel).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-goal"); S.goal.preset = k;
        var p = C.goals[k];
        if (p) {
          S.goal.target = p.amount; S.goal.years = p.years;
          if (p.shariah && !S.shariah) { S.shariah = true; S.goal.autoShariah = true; applyStatic(); }
        }
        renderGoal();
      });
    });
    bindMoney("goalAmt", function (v) { S.goal.target = v; S.goal.preset = S.goal.preset; renderGoalResults(); });
    $("#goalYears").addEventListener("input", function (e) {
      S.goal.years = +e.target.value; $("#goalYears-v").textContent = t("yearsVal", { n: digits(S.goal.years) }); renderGoalResults();
    });
    $("#goalInf").addEventListener("change", function (e) { S.goal.inflate = e.target.checked; renderGoalResults(); });
    renderGoalResults();
  }
  // Amount needed to reach `target`; iterates because excise duty and the Sanchaypatra rate depend on the amount
  function solveNeed(id, monthly, target, months, rateKey) {
    var br = S.cmp.bracket, need = target / outcome(id, monthly, 1, months, months, br, rateKey).value;
    for (var k = 0; k < 6; k++) {
      var got = outcome(id, monthly, need, months, months, br, rateKey).value;
      if (got <= 0) break;
      need = need * target / got;
    }
    return need;
  }
  function solveLump(id, target, months) {
    var ins = C.instruments[id];
    var hi = solveNeed(id, false, target, months, "high");
    return [hi, ins.kind === "fund" ? solveNeed(id, false, target, months, "low") : hi];
  }
  function solveMonthly(id, target, months) {
    var ins = C.instruments[id];
    var hi = solveNeed(id, true, target, months, "high");
    return [hi, ins.kind === "fund" ? solveNeed(id, true, target, months, "low") : hi];
  }
  function renderGoalResults() {
    var g = S.goal, months = g.years * 12;
    var target = g.inflate ? g.target * Math.pow(1 + C.inflation / 100, g.years) : g.target;
    $("#goalInfNote").textContent = g.inflate ? t("goalInflNote", { now: short(g.target), then: short(target) }) : "";
    var ids = visibleIds(null);
    var rows = ids.map(function (id) {
      var ins = C.instruments[id];
      var l = ins.modes.indexOf("lump") >= 0 ? solveLump(id, target, months) : null;
      var m = ins.modes.indexOf("monthly") >= 0 ? solveMonthly(id, target, months) : null;
      return { id: id, l: l, m: m, fund: ins.kind === "fund" };
    });
    function cell(v, fund) {
      if (!v) return '<span class="dash">—</span>';
      if (fund && Math.round(v[0]) !== Math.round(v[1])) return '<span class="v num">' + tk(roundUp(v[0])) + '</span><span class="sm num">– ' + tk(roundUp(v[1])) + '</span>';
      return '<span class="v num">' + tk(roundUp(v[0])) + '</span>';
    }
    var notes = [];
    if (g.preset === "emergency") notes.push('<div class="callout warn"><p>' + t("goalEmergencyNote") + '</p></div>');
    if ((g.preset === "hajj" || g.preset === "umrah") && S.shariah) notes.push('<div class="callout olive"><p>' + t("goalHajjNote") + '</p></div>');
    S.summary = t("sumGoal", { target: short(g.target), years: digits(g.years) });
    S.lastCard = { type: "goal", rows: rows, target: target, years: g.years };
    $("#goalOut").innerHTML =
      '<div class="results-head"><h2>' + t("goalHead", { target: tk(roundUp(target)) }) + '</h2><span class="sub">' + t("afterTax") + '</span></div>' +
      '<div class="table-scroll"><table class="gtable"><thead><tr><th></th><th>' + t("colToday") + '</th><th>' + t("colMonthly") + '</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + t("name_" + r.id) + '<span class="sm">' + t("risk" + C.instruments[r.id].risk) + '</span></td><td>' + cell(r.l, r.fund) + '</td><td>' + cell(r.m, r.fund) + '</td></tr>';
      }).join("") + '</tbody></table></div>' +
      '<p class="note">' + t("goalFundNote") + '</p>' + notes.join("") +
      '<div class="actions"><button type="button" class="btn primary" data-share>' + t("shareBtn") + '</button>' +
      '<a class="btn ghost" data-wa target="_blank" rel="noopener" href="' + waLink() + '">' + t("talkBtn") + '</a></div>';
    bindResultActions($("#goalOut"));
    updateFab();
  }
  function roundUp(v) { var step = v >= 100000 ? 1000 : (v >= 10000 ? 100 : 10); return Math.ceil(v / step) * step; }

  // ---------- TAB: tax ----------
  function renderTax() {
    var x = S.tax;
    panel.innerHTML =
      '<div class="card"><h2>' + t("taxHead") + '</h2><p class="sub">' + t("taxYearNote", { year: fixDigits(S.lang === "bn" ? T.incomeYearBn : T.incomeYearEn) }) + '</p><div class="form">' +
      moneyField("taxInc", t("taxIncome"), x.income, [600000, 900000, 1500000, 3000000]) +
      '<label class="check" for="taxSal"><input type="checkbox" id="taxSal"' + (x.salaried ? " checked" : "") + '><span>' + t("taxSalaried") + '<br><span class="help">' + t("taxSalariedHelp") + '</span></span></label>' +
      '<label class="check" for="taxSp"><input type="checkbox" id="taxSp"' + (x.special ? " checked" : "") + '><span>' + t("taxSpecial") + '</span></label>' +
      moneyField("taxInv", t("taxInvested"), x.invested, null, t("taxInvestedHelp")) +
      '</div></div><div class="card" id="taxOut"></div>';
    bindMoney("taxInc", function (v) { S.tax.income = v; renderTaxResults(); });
    bindMoney("taxInv", function (v) { S.tax.invested = v; renderTaxResults(); });
    $("#taxSal").addEventListener("change", function (e) { S.tax.salaried = e.target.checked; renderTaxResults(); });
    $("#taxSp").addEventListener("change", function (e) { S.tax.special = e.target.checked; renderTaxResults(); });
    renderTaxResults();
  }
  function renderTaxResults() {
    var r = taxCalc(S.tax), out = $("#taxOut"), n = monthsToJune();
    S.summary = t("sumTax", { income: short(S.tax.income) });
    S.lastCard = null;
    if (r.gross <= 0 || r.maxRebate <= 0) {
      out.innerHTML = '<div class="callout"><p>' + (r.gross <= 0 ? t("taxNoTax") : t("taxMinNote")) + '</p></div>';
      updateFab(); return;
    }
    var perMonth = r.remaining / n;
    var whereIds = S.shariah ? ["sasf", "mdps"] : ["sfif", "sfiuf", "sasf", "sanchay", "dps"];
    var where = whereIds.map(function (id) {
      var ins = C.instruments[id], cap = ins.rebateCeiling, fits = cap >= r.remaining;
      return '<strong>' + t("name_" + id) + '</strong>: ' + t("rebateLine", { cap: short(cap), max: tk(cap * T.rebate.investPct) }) +
        (r.remaining > 0 ? ' <span class="' + (fits ? "fit" : "nofit") + '">' + (fits ? t("rebateFits") : t("rebateNoFit")) + '</span>' : "") +
        ' ' + t("rebateNote_" + (ins.kind === "fund" ? "fund" : ins.kind));
    });
    where.push('<strong>' + t("name_fdr") + '</strong>: ' + t("rebateNoneFdr"));
    out.innerHTML =
      '<div class="stats">' +
      stat(t("taxBefore"), tk(r.gross)) +
      stat(t("taxCanSave"), tk(r.maxRebate), true) +
      stat(t("taxNeedInvest"), tk(Math.ceil(r.needInvest))) +
      (r.remaining > 0 ? stat(t("taxRemaining"), tk(Math.ceil(r.remaining))) : stat(t("taxAfter"), tk(r.after))) +
      '</div>' +
      (r.remaining > 0
        ? '<div class="callout" style="margin-top:12px"><p class="k">' + t("taxMonthly", { n: digits(n) }) + '</p><p class="big num">' + tk(roundUp(perMonth)) + '</p><p>' + t("taxAfter") + ': <strong class="num">' + tk(r.after) + '</strong></p></div>'
        : '<div class="callout" style="margin-top:12px"><p>' + t("taxDone") + '</p></div>') +
      (r.above ? '<p class="note">' + t("taxMinNote") + '</p>' : "") +
      '<h3 class="sub-h">' + t("taxWhere") + '</h3><ul class="list">' + where.map(function (w) { return '<li>' + w + '</li>'; }).join("") + '</ul>' +
      '<p class="note">' + t("taxDisclaimer") + '</p>' +
      '<div class="actions"><a class="btn primary" data-wa target="_blank" rel="noopener" href="' + waLink() + '">' + t("talkBtn") + '</a></div>';
    updateFab();
  }
  function stat(k, v, hl) { return '<div class="stat' + (hl ? " hl" : "") + '"><div class="k">' + k + '</div><div class="v num">' + v + '</div></div>'; }

  // ---------- TAB: business ----------
  function renderBiz() {
    var b = S.biz, B = C.business;
    var places = S.shariah ? [["wadiah", t("bizWadiah")], ["msnd", t("bizMsnd", { r: pct(B.mudarabaSnd) })]]
                           : [["current", t("bizCurrent")], ["snd", t("bizSnd", { r: pct(B.snd) })]];
    if (!places.some(function (p) { return p[0] === b.place; })) b.place = places[0][0];
    panel.innerHTML =
      '<div class="card"><h2>' + t("bizHead") + '</h2><p class="sub">' + t("bizSub") + '</p><div class="form">' +
      moneyField("bizAmt", t("bizAmount"), b.amount, [500000, 2000000, 5000000, 10000000]) +
      rangeField("bizMonths", t("bizMonths"), 1, 24, b.months, "bizMonthsVal") +
      '<div class="field"><label for="bizPlace">' + t("bizWhere") + '</label><select id="bizPlace">' +
      places.map(function (p) { return '<option value="' + p[0] + '"' + (b.place === p[0] ? " selected" : "") + '>' + p[1] + '</option>'; }).join("") +
      '</select></div></div></div><div class="card" id="bizOut"></div>';
    bindMoney("bizAmt", function (v) { S.biz.amount = v; renderBizResults(); });
    $("#bizMonths").addEventListener("input", function (e) {
      S.biz.months = +e.target.value; $("#bizMonths-v").textContent = t("bizMonthsVal", { n: digits(S.biz.months) }); renderBizResults();
    });
    $("#bizPlace").addEventListener("change", function (e) { S.biz.place = e.target.value; renderBizResults(); });
    renderBizResults();
  }
  function renderBizResults() {
    var b = S.biz, B = C.business, yrs = b.months / 12;
    var nowRate = { current: B.current, snd: B.snd, wadiah: B.wadiah, msnd: B.mudarabaSnd }[b.place] / 100;
    var now = b.amount * nowRate * yrs;
    var fid = S.shariah ? "sasf" : "sfif", f = C.instruments[fid];
    var lo = b.amount * (Math.pow(1 + f.low / 100, yrs) - 1), hi = b.amount * (Math.pow(1 + f.high / 100, yrs) - 1);
    S.summary = t("sumBiz", { amount: short(b.amount), months: digits(b.months) });
    S.lastCard = null;
    $("#bizOut").innerHTML =
      '<div class="stats">' +
      stat(t("bizNow"), tk(now)) +
      stat(t("bizFund", { name: t("short_" + fid) }), tk(lo) + ' – ' + tk(hi), true) +
      '</div>' +
      '<div class="callout" style="margin-top:12px"><p class="k">' + t("bizExtra") + '</p><p class="big num">' + tk(lo - now) + ' – ' + tk(hi - now) + '</p><p class="help">' + t("fundRange", { low: pct(f.low), high: pct(f.high) }) + ' · ' + t("estimate") + '</p></div>' +
      (S.shariah ? '<div class="callout warn" style="margin-top:10px"><p>' + t("bizShariahWarn") + '</p></div>' : "") +
      '<p class="note">' + t("bizTaxNote") + '</p>' +
      '<div class="actions"><a class="btn primary" data-wa target="_blank" rel="noopener" href="' + waLink() + '">' + t("bizCta") + '</a></div>';
    updateFab();
  }

  // ---------- TAB: guide ----------
  var NEEDLE = { fdr: 0.06, dps: 0.06, sanchay: 0.04, sfif: 0.14, sfiuf: 0.62, sasf: 0.62, mtd: 0.08, mdps: 0.08 };
  function meter(v) {
    // semicircle in five bands, like the brochure risk meter
    var cols = ["--m1", "--m2", "--m3", "--m4", "--m5"], segs = "";
    for (var i = 0; i < 5; i++) {
      var a0 = Math.PI * (1 - i / 5), a1 = Math.PI * (1 - (i + 1) / 5);
      var p = function (a, r) { return (46 + r * Math.cos(a)).toFixed(2) + " " + (48 - r * Math.sin(a)).toFixed(2); };
      segs += '<path d="M' + p(a0, 44) + ' A44 44 0 0 1 ' + p(a1, 44) + ' L' + p(a1, 24) + ' A24 24 0 0 0 ' + p(a0, 24) + ' Z" fill="var(' + cols[i] + ')" stroke="var(--surface)" stroke-width="1.5"/>';
    }
    var a = Math.PI * (1 - v), nx = 46 + 36 * Math.cos(a), ny = 48 - 36 * Math.sin(a);
    return '<svg viewBox="0 0 92 52" role="img" aria-label="' + t("riskMeter") + '">' + segs +
      '<line x1="46" y1="48" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/>' +
      '<circle cx="46" cy="48" r="4" fill="var(--ink)"/></svg>';
  }
  // Side-by-side table (based on SAML's IFA orientation comparison)
  function compareTable() {
    var tb = t("cmpTable"), cols = S.shariah ? ["mtd", "mdps", "sasf"] : ["fdr", "sanchay", "tbond", "sfif", "sfiuf", "sasf"];
    var head = '<tr><th scope="col"></th>' + cols.map(function (c) { return '<th scope="col">' + (tb.names[c] || t("name_" + c)) + '</th>'; }).join("") + '</tr>';
    var body = tb.rows.map(function (label, ri) {
      return '<tr><th scope="row">' + label + '</th>' + cols.map(function (c) {
        var cell = tb.cols[c][ri];
        return '<td class="' + (cell[1] || "") + '">' + cell[0] + '</td>';
      }).join("") + '</tr>';
    }).join("");
    return '<div class="card ctable-card"><div class="table-scroll"><table class="ctable">' + head + body + '</table></div><p class="help">' + tb.note + '</p></div>';
  }
  function renderGuide() {
    var ids = visibleIds(null);
    panel.innerHTML = '<h2>' + t("guideHead") + '</h2>' + compareTable() + '<h2 class="guide-sub">' + t("guideCards") + '</h2><div class="guide">' + ids.map(function (id) {
      var ins = C.instruments[id], g = t("gd_" + id);
      function fill(s) { return s.replace("{rate}", pct(ins.rate || 0)).replace("{low}", pct(ins.low || 0)).replace("{high}", pct(ins.high || 0)); }
      var past = ins.past ? '<dt>' + t("g_past") + '</dt><dd>' + fixDigits(ins.past[S.lang]) + '</dd>' : "";
      return '<article class="gcard"><div class="gcard-head"><div><h3>' + t("name_" + id) + '</h3>' + tagsFor(id) + '</div>' +
        '<div class="gmeter">' + meter(NEEDLE[id]) + '<span>' + t("riskMeter") + '</span></div></div>' +
        '<dl class="gdl"><dt>' + t("g_return") + '</dt><dd>' + fill(g.ret) + '</dd>' + past +
        '<dt>' + t("g_tax") + '</dt><dd>' + g.tax + '</dd>' +
        '<dt>' + t("g_min") + '</dt><dd>' + g.min + '</dd>' +
        '<dt>' + t("g_exit") + '</dt><dd>' + g.exit + '</dd>' +
        '<dt>' + t("g_best") + '</dt><dd>' + g.best + '</dd></dl></article>';
    }).join("") + '</div>';
    S.summary = ""; S.lastCard = null;
    updateFab();
  }

  // ---------- shared bindings ----------
  function bindMoney(id, cb) {
    var el = $("#" + id), w = $("#" + id + "-w");
    el.addEventListener("input", function () {
      var v = parseNum(el.value);
      w.textContent = "= " + short(v);
      cb(v);
    });
    el.addEventListener("blur", function () { el.value = digits(group(parseNum(el.value))); });
    $$('[data-set="' + id + '"]', panel).forEach(function (b) {
      b.addEventListener("click", function () {
        var v = +b.getAttribute("data-val");
        el.value = digits(group(v)); w.textContent = "= " + short(v); cb(v);
      });
    });
  }
  function bindResultActions(root) {
    var s = $("[data-share]", root);
    if (s) s.addEventListener("click", openShare);
  }

  function render() {
    applyStatic();
    panel.className = "panel " + (S.tab === "guide" ? "guide-tab" : "split");
    ({ compare: renderCompare, goal: renderGoal, tax: renderTax, biz: renderBiz, guide: renderGuide })[S.tab]();
    movePill();
  }
  function movePill() {
    var tabs = $(".tabs"), pill = $(".pill"), on = $('.tabs button[aria-selected="true"]');
    if (!tabs || !pill || !on) return;
    pill.style.left = on.offsetLeft + "px";
    pill.style.width = on.offsetWidth + "px";
  }

  // ---------- WhatsApp ----------
  function waLink(extra) {
    var msg = t("waHello");
    if (S.summary) msg += "\n" + t("waAbout", { summary: S.summary });
    if (extra) msg += "\n" + extra;
    return "https://wa.me/" + C.advisor.whatsapp + "?text=" + encodeURIComponent(msg);
  }
  function updateFab() { $("#fab").href = waLink(); }

  // ---------- share card ----------
  // ---------- QR (WhatsApp) ----------
  function waQr() {
    if (typeof window.qrcode !== "function") return null;
    try { var q = window.qrcode(0, "M"); q.addData(C.advisor.whatsappContact || ("https://wa.me/" + C.advisor.whatsapp)); q.make(); return q; }
    catch (e) { return null; }
  }
  function drawQr(x, q, X, Y, size, dark, light) {
    var n = q.getModuleCount(), quiet = 2, cell = size / (n + quiet * 2);
    x.fillStyle = light; x.fillRect(X, Y, size, size);
    x.fillStyle = dark;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (q.isDark(r, c)) x.fillRect(X + (c + quiet) * cell, Y + (r + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  function paintQr(cv) {
    var q = waQr(); if (!cv) return;
    var fig = cv.parentNode;
    if (!q) { fig.hidden = true; return; }
    fig.hidden = false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), size = 132;
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + "px"; cv.style.height = size + "px";
    var x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawQr(x, q, 0, 0, size, "#111214", "#FFFFFF");
  }

  function openShare() {
    var go = function () {
      var canvas = drawCard(), url;
      if (!canvas) return;
      url = canvas.toDataURL("image/png");
      $("#shareImg").src = url;
      $("#saveImg").href = url;
      $("#shareModal").hidden = false;
      $("#shareNow").hidden = !(navigator.canShare && window.File);
      $("#shareNow").onclick = function () {
        canvas.toBlob(function (blob) {
          var file = new File([blob], "wealthlens.png", { type: "image/png" });
          var data = { files: [file], text: t("cardFooter") + ": " + siteLink() };
          if (navigator.canShare && navigator.canShare(data)) navigator.share(data).catch(function () {});
        });
      };
    };
    var fonts = document.fonts;
    if (fonts && fonts.load) {
      Promise.all([fonts.load('700 60px "Hind Siliguri"'), fonts.load('500 36px "Hind Siliguri"'), fonts.load('400 30px "Hind Siliguri"')])
        .then(go, go);
    } else go();
  }

  // Banknote-style rosette: two spirograph curves drawn as hairlines
  function rosette(x, cx, cy, R, color, alpha) {
    x.save(); x.translate(cx, cy); x.strokeStyle = color; x.globalAlpha = alpha; x.lineWidth = 1;
    [[50, 9, 30, 1], [50, 13, 21, 0.62]].forEach(function (p) {
      var A = p[0], B = p[1], D = p[2], k = R * p[3] / (A - B + D);
      x.beginPath();
      for (var t = 0; t <= Math.PI * 2 * B + 0.01; t += 0.012) {
        var X = ((A - B) * Math.cos(t) + D * Math.cos(((A - B) / B) * t)) * k;
        var Y = ((A - B) * Math.sin(t) - D * Math.sin(((A - B) / B) * t)) * k;
        if (t === 0) x.moveTo(X, Y); else x.lineTo(X, Y);
      }
      x.stroke();
    });
    x.beginPath(); x.arc(0, 0, R * 1.04, 0, Math.PI * 2); x.stroke();
    x.restore();
  }
  function waves(x, w, y0, rows, color, alpha) {
    x.save(); x.strokeStyle = color; x.globalAlpha = alpha; x.lineWidth = 1;
    for (var j = 0; j < rows; j++) {
      x.beginPath();
      for (var X = 0; X <= w; X += 6) {
        var Y = y0 + j * 7 + Math.sin(X / 38 + j * 0.45) * 9 + Math.sin(X / 91 + j * 0.2) * 5;
        if (X === 0) x.moveTo(X, Y); else x.lineTo(X, Y);
      }
      x.stroke();
    }
    x.restore();
  }
  function drawGuilloche() {
    var cv = $(".guilloche"); if (!cv) return;
    var box = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!box.width) return;
    cv.width = Math.round(box.width * dpr); cv.height = Math.round(box.height * dpr);
    var x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    var gold = getComputedStyle(document.documentElement).getPropertyValue("--gold").trim() || "#C29B4A";
    var w = box.width, h = box.height, R = Math.min(h * 0.62, 260);
    rosette(x, w > 700 ? w - R * 1.1 : w - R * 0.3, h * 0.44, R, gold, 0.2);
    waves(x, w, h - 46, 6, gold, 0.10);
  }

  function wrapText(ctx, text, maxW) {
    var parts = text.split(" "), lines = [], line = "";
    parts.forEach(function (w) {
      var test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }
  function siteLink() { return "https://" + C.siteUrl + "/?utm_source=sharecard&utm_medium=social"; }
  function siteQr() {
    if (typeof window.qrcode !== "function") return null;
    try { var q = window.qrcode(0, "M"); q.addData(siteLink()); q.make(); return q; } catch (e) { return null; }
  }
  // WealthLens mark: lens ring + six aperture blades + ৳ (same geometry as the SVG logo, 44-unit box)
  function drawMark(x, X, Y, size, gold) {
    var k = size / 44, blades = [[22, 13.8, 38.45, 23.3], [29.1, 17.9, 29.1, 36.89], [29.1, 26.1, 12.65, 35.6], [22, 30.2, 5.55, 20.7], [14.9, 26.1, 14.9, 7.11], [14.9, 17.9, 31.35, 8.4]];
    x.save(); x.translate(X, Y); x.scale(k, k); x.strokeStyle = gold; x.fillStyle = gold; x.lineCap = "round";
    x.lineWidth = 1.5; x.beginPath(); x.arc(22, 22, 20.6, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 1.15; blades.forEach(function (l) { x.beginPath(); x.moveTo(l[0], l[1]); x.lineTo(l[2], l[3]); x.stroke(); });
    x.font = '600 10px "Hind Siliguri", sans-serif'; x.textAlign = "center"; x.fillText("৳", 22, 25.6);
    x.restore();
  }
  function blob(x, cx, cy, r, color) {
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  function drawCard() {
    var lc = S.lastCard; if (!lc) return null;
    var W = 1080, H = 1350, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var x = cv.getContext("2d");
    var f = '"Hind Siliguri", -apple-system, "Segoe UI", sans-serif';
    var white = "#F6F8F4", soft = "rgba(246,248,244,0.72)", gold = "#E3C27E", fill = "#F2F2F0", track = "rgba(255,255,255,0.12)";
    // liquid glass ground
    x.fillStyle = "#0A0A0B"; x.fillRect(0, 0, W, H);
    blob(x, 120, 160, 700, "rgba(70,70,76,0.85)");
    blob(x, 980, 520, 620, "rgba(48,48,54,0.9)");
    blob(x, 300, 1250, 560, "rgba(214,180,112,0.45)");
    blob(x, 900, 1200, 420, "rgba(40,40,44,0.9)");
    x.textBaseline = "alphabetic"; x.textAlign = "left";

    // brand
    drawMark(x, 60, 58, 68, gold);
    x.fillStyle = white; x.font = "700 44px " + f; x.fillText("WealthLens", 146, 100);
    x.fillStyle = gold; x.font = "500 26px " + f; x.fillText(t("tagline"), 148, 136);

    // frosted panel
    var px = 56, py = 186, pw = W - 112, ph = 770;
    x.fillStyle = "rgba(255,255,255,0.09)"; roundRect(x, px, py, pw, ph, 44); x.fill();
    var rim = x.createLinearGradient(px, py, px + pw, py + ph);
    rim.addColorStop(0, "rgba(255,255,255,0.55)"); rim.addColorStop(0.45, "rgba(255,255,255,0.06)"); rim.addColorStop(1, "rgba(255,255,255,0.3)");
    x.strokeStyle = rim; x.lineWidth = 2; roundRect(x, px, py, pw, ph, 44); x.stroke();

    var y = py + 86, title, sub;
    if (lc.type === "compare") {
      var d = lc.data, c = S.cmp;
      title = d.lump ? t("cardLump", { amount: tk(d.amt), years: digits(c.years) }) : t("cardMonthly", { amount: tk(d.amt), years: digits(c.years) });
      sub = c.early ? t("resultHeadEarly", { m: digits(d.e) }) : t("cardTop");
    } else {
      title = t("cardGoal", { target: short(lc.target), years: digits(lc.years) });
      sub = t("cardGoalTop");
    }
    x.fillStyle = white; x.font = "700 58px " + f;
    wrapText(x, title, pw - 96).slice(0, 2).forEach(function (l) { x.fillText(l, px + 48, y); y += 70; });
    x.fillStyle = gold; x.font = "500 32px " + f; x.fillText(fitText(x, sub, pw - 96), px + 48, y - 14); y += 28;
    if (lc.type === "compare") { x.fillStyle = soft; x.font = "400 28px " + f; x.fillText(t("cardPaid", { paid: tk(lc.data.paid) }), px + 48, y); }

    var rows;
    if (lc.type === "compare") rows = lc.data.rows.slice(0, 5).map(function (r) { return { id: r.id, lo: r.lo, hi: r.hi, fund: r.fund }; });
    else rows = lc.rows.filter(function (r) { return r.m; }).map(function (r) { return { id: r.id, lo: r.m[0], hi: r.m[1], fund: r.fund }; })
      .sort(function (a, b) { return a.lo - b.lo; }).slice(0, 5);
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.hi, r.lo); })) * 1.02;
    var top = y + 30, bottom = py + ph - 40, step = Math.min(96, (bottom - top) / Math.max(rows.length, 1));
    rows.forEach(function (r, i) {
      var ry = top + step * i + 46;
      x.fillStyle = gold; x.font = "700 32px " + f; x.fillText(digits(i + 1), px + 48, ry);
      x.fillStyle = white; x.font = "600 32px " + f; x.fillText(t("short_" + r.id), px + 96, ry);
      var lo = Math.min(r.lo, r.hi), hi = Math.max(r.lo, r.hi);
      var val = r.fund && Math.round(lo) !== Math.round(hi) ? tk(roundUp(lo)) + " – " + tk(roundUp(hi)) : tk(roundUp(lo));
      x.font = "700 34px " + f; x.textAlign = "right"; x.fillText(val, px + pw - 48, ry); x.textAlign = "left";
      var by = ry + 18, bx = px + 96, bw = pw - 144;
      x.fillStyle = track; roundRect(x, bx, by, bw, 9, 4.5); x.fill();
      if (r.fund) { x.fillStyle = gold; roundRect(x, bx, by, hi / max * bw, 9, 4.5); x.fill(); }
      x.fillStyle = fill; roundRect(x, bx, by, lo / max * bw, 9, 4.5); x.fill();
    });

    // call to action + QR to the website
    var q = siteQr(), qs = 230, qx = W - 56 - qs, qy = py + ph + 44;
    var tx = 64, maxT = (q ? qx - 40 : W - 64) - tx;
    x.fillStyle = white; x.font = "700 46px " + f;
    var cy = qy + 52;
    wrapText(x, t("cardFooter") + " →", maxT).slice(0, 2).forEach(function (l) { x.fillText(l, tx, cy); cy += 58; });
    x.fillStyle = gold; x.font = "700 38px " + f; x.fillText(fitText(x, C.siteUrl, maxT), tx, cy + 20);
    if (q) {
      x.fillStyle = "#FFFFFF"; roundRect(x, qx - 12, qy - 12, qs + 24, qs + 24, 26); x.fill();
      drawQr(x, q, qx, qy, qs, "#111214", "#FFFFFF");
      x.fillStyle = soft; x.font = "500 22px " + f; x.fillText(fitText(x, t("cardScan"), maxT), tx, qy + qs - 4);
    }
    x.fillStyle = "rgba(246,248,244,0.55)"; x.font = "400 20px " + f; x.textAlign = "center";
    x.fillText(t("cardNote"), W / 2, H - 30); x.textAlign = "left";
    return cv;
  }
  function fitText(x, text, maxW) {
    if (x.measureText(text).width <= maxW) return text;
    while (text.length > 1 && x.measureText(text + "…").width > maxW) text = text.slice(0, -1);
    return text + "…";
  }
  function roundRect(x, X, Y, w, h, r) {
    w = Math.max(w, 0); r = Math.min(r, w / 2, h / 2);
    x.beginPath(); x.moveTo(X + r, Y); x.lineTo(X + w - r, Y); x.arcTo(X + w, Y, X + w, Y + r, r);
    x.lineTo(X + w, Y + h - r); x.arcTo(X + w, Y + h, X + w - r, Y + h, r); x.lineTo(X + r, Y + h);
    x.arcTo(X, Y + h, X, Y + h - r, r); x.lineTo(X, Y + r); x.arcTo(X, Y, X + r, Y, r); x.closePath();
  }

  // ---------- lead form ----------
  function bindLead() {
    function readLead() {
      var name = $("#leadName").value.trim(), phone = toLatin($("#leadPhone").value).replace(/[^0-9]/g, "");
      if (phone.indexOf("880") === 0) phone = "0" + phone.slice(3);
      var err = $("#leadError"), topicSel = $("#leadTopic");
      var msg = !name ? t("leadErrName") : (!/^01[3-9][0-9]{8}$/.test(phone) ? t("leadErrPhone") : (!$("#leadConsent").checked ? t("leadErrConsent") : ""));
      err.hidden = !msg; err.textContent = msg;
      if (msg) return null;
      return { name: name, phone: phone, topic: topicSel.options[topicSel.selectedIndex].textContent };
    }
    // The lead goes to WhatsApp with the person's details and their calculation already typed in
    $("#leadForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var p = readLead(); if (!p) return;
      var url = waLink(t("waLead", p));
      try { window.open(url, "_blank", "noopener"); } catch (x) {}
      var done = $("#leadDone");
      done.hidden = false;
      done.innerHTML = '<p><strong>' + esc(t("leadThanks", { name: p.name })) + '</strong></p><p>' + t("leadWaSendHint") + '</p>' +
        '<a class="btn primary" target="_blank" rel="noopener" href="' + url + '">' + t("leadWaBtn") + '</a>';
    });
  }

  // ---------- events ----------
  $("#langBtn").addEventListener("click", function () {
    S.lang = S.lang === "bn" ? "en" : "bn";
    try { localStorage.setItem("sanchay-lang", S.lang); } catch (e) {}
    render();
  });
  $$(".tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      S.tab = b.getAttribute("data-tab");
      try { history.replaceState(null, "", "#" + S.tab); } catch (e) {}
      render();
      b.scrollIntoView({ inline: "nearest", block: "nearest" });
    });
  });
  $(".tabs").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var tabs = $$(".tabs button"), i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    n.focus(); n.click();
  });
  $("#shariah").addEventListener("change", function (e) { S.shariah = e.target.checked; render(); });
  $("#shareClose").addEventListener("click", function () { $("#shareModal").hidden = true; });
  $("#shareModal").addEventListener("click", function (e) { if (e.target.id === "shareModal") $("#shareModal").hidden = true; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") $("#shareModal").hidden = true; });
  bindLead();

  // expose maths for testing
  window.__calc = { outcome: outcome, lumpValue: lumpValue, monthlyValue: monthlyValue, taxCalc: taxCalc, solveMonthly: solveMonthly, solveLump: solveLump };

  render();
  drawGuilloche();
  var gT;
  window.addEventListener("resize", function () { clearTimeout(gT); gT = setTimeout(movePill, 120); });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", drawGuilloche);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(movePill);
})();
