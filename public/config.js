/*
  ============================================================
  SETTINGS FILE — update this after every budget / rate change
  ============================================================
  All rates are yearly percentages (10 = 10%).
  After editing, push to GitHub and Vercel updates the site in about a minute.
*/
window.CONFIG = {
  lastUpdated: "2026-10-22",

  // ---- You ----
  advisor: {
    nameBn: "মেহেদী হাসান",
    nameEn: "Mehedi Hasan",
    titleBn: "ফাইন্যান্সিয়াল প্ল্যানার",
    titleEn: "Financial Planner",
    companyBn: "শান্তা অ্যাসেট ম্যানেজমেন্ট লিমিটেড",
    companyEn: "Shanta Asset Management Limited",
    whatsapp: "8801706433577",          // international format, no + or spaces
    whatsappDisplay: "01706-433577",
    whatsappContact: "https://wa.me/qr/IN4WPIU6IMSWH1",   // your WhatsApp contact link (used for the profile button and QR)
    facebook: ""                        // paste your Facebook profile/page link here, e.g. "https://facebook.com/yourname"
  },

  // Your live site address (shown on the share image). Change after Vercel gives you the link.
  siteUrl: "wealthlens-ochre.vercel.app",





  // Numbers in Bangla mode: false = English digits (৳8,64,018, easier to read), true = Bangla digits (৳৮,৬৪,০১৮)
  banglaDigits: false,

  inflation: 8,

  // Bank excise duty, charged once a year on FDR/DPS/savings balances: [balance above, taka per year].
  // Exemption raised to ৳4 lakh in the 2026-27 budget; other slabs as set in 2024-25. Verify after each budget.
  excise: [
    [400000, 150],
    [500000, 500],
    [1000000, 3000],
    [5000000, 5000],
    [10000000, 10000],
    [20000000, 20000],
    [50000000, 50000]
  ],          // used in the goal calculator "prices will rise" option

  // ---- Tax rules (Finance Act 2026, income year July 2026 – June 2027) ----
  tax: {
    incomeYearBn: "২০২৬-২৭ আয়বর্ষ (জুলাই ২০২৬ – জুন ২০২৭)",
    incomeYearEn: "Income year 2026-27 (July 2026 – June 2027)",
    thresholdGeneral: 400000,
    thresholdWomenSenior: 425000,      // women & 65+ — verify with your tax adviser
    slabs: [                            // [width of slab, rate]
      [300000, 0.10],
      [400000, 0.15],
      [500000, 0.20],
      [2000000, 0.25],
      [Infinity, 0.30]
    ],
    minTax: 5000,
    rebate: { incomePct: 0.03, investPct: 0.10, cap: 750000 },
    salaryExclusion: { fraction: 1 / 3, cap: 500000 },
    interestTDS: 0.10,                  // tax cut at source on bank / Sanchaypatra profit
    fundGainTax: 0.045                  // max effective tax on fund return (15% on up to 30% paid as dividend)
  },

  // ---- Options compared ----
  // kind: fdr (lump sum, renews yearly) | dps (monthly) | sanchay | fund
  // modes: lump = one-time, monthly = every month
  instruments: {
    fdr: {
      rebateCeiling: 0,   // yearly investment that counts for the tax rebate
      kind: "fdr", modes: ["lump"], shariah: false, risk: 1, rebate: false,
      rate: 10.0,            // typical 1-year FDR
      breakRate: 3.0          // what banks usually pay if broken before the year ends
    },
    dps: {
      rebateCeiling: 120000,   // yearly investment that counts for the tax rebate
      kind: "dps", modes: ["monthly"], shariah: false, risk: 1, rebate: true,
      rate: 10.5,             // typical 3–5 year DPS
      breakRate: 3.0,
      noProfitBeforeMonths: 12
    },
    sanchay: {
      rebateCeiling: 500000,   // yearly investment that counts for the tax rebate
      kind: "sanchay", modes: ["lump"], shariah: false, risk: 1, rebate: true,
      // 3-month profit Sanchaypatra (3-year term). Rates unchanged since July 2025.
      termYears: 3,
      rate: 11.82,            // up to ৳7.5 lakh
      rateHigh: 11.77,        // above ৳7.5 lakh
      tierLimit: 750000,
      earlyRates: [0, 10.65, 11.22]   // if cashed after 0 / 1 / 2 completed years
    },
    sfif: {
      rebateCeiling: 7500000,   // yearly investment that counts for the tax rebate
      kind: "fund", modes: ["lump", "monthly"], shariah: false, risk: 1, rebate: true,
      low: 10.0, high: 12.0,  // SAML IFA orientation (Oct 2026): expected 10%–12% a year
      past: { bn: "বছরের রিটার্ন: ২০২৪-এ ১০.১%, ২০২৫-এ ১৩.৩%, ২০২৬-এর প্রথম ৯ মাসে ১৩.৭%", en: "Yearly return: 10.1% in 2024, 13.3% in 2025, 13.7% in the first 9 months of 2026" }
    },
    sfiuf: {
      rebateCeiling: 7500000,   // yearly investment that counts for the tax rebate
      kind: "fund", modes: ["lump", "monthly"], shariah: false, risk: 2, rebate: true,
      low: 12.0, high: 15.0,  // SAML IFA orientation: expected 12%–15% over the long term
      past: { bn: "শুরু (২০১৮) থেকে মোট ৭৩.২%, একই সময়ে DSEX −৪.৮%; গত ২ বছরে ১৬.৩% (৩০ সেপ্টেম্বর ২০২৬ পর্যন্ত)", en: "73.2% in total since launch (2018) while DSEX fell 4.8%; 16.3% over the last 2 years (to 30 Sep 2026)" }
    },
    sasf: {
      rebateCeiling: 7500000,   // yearly investment that counts for the tax rebate
      kind: "fund", modes: ["lump", "monthly"], shariah: true, risk: 2, rebate: true,
      low: 10.0, high: 12.0,  // SAML IFA orientation: expected 10%–12% over the long term
      past: { bn: "শুরু (২০১৯) থেকে মোট ৪১.৫%, একই সময়ে বাজার −১৬.৪%; গত ২ বছরে ৯.৭% (৩০ সেপ্টেম্বর ২০২৬ পর্যন্ত)", en: "41.5% in total since launch (2019) while the market fell 16.4%; 9.7% over the last 2 years (to 30 Sep 2026)" }
    },
    mtd: {
      rebateCeiling: 0,   // yearly investment that counts for the tax rebate
      kind: "fdr", modes: ["lump"], shariah: true, risk: 1, rebate: false,
      rate: 9.0,              // Islamic bank Mudaraba term deposit (provisional rate)
      breakRate: 2.5
    },
    mdps: {
      rebateCeiling: 120000,   // yearly investment that counts for the tax rebate
      kind: "dps", modes: ["monthly"], shariah: true, risk: 1, rebate: true,
      rate: 9.5,              // Islamic bank Mudaraba monthly savings scheme
      breakRate: 2.5,
      noProfitBeforeMonths: 12
    }
  },

  // Order of options on screen
  order: ["sanchay", "fdr", "dps", "sfif", "sfiuf", "sasf", "mtd", "mdps"],

  // Business cash (pre-tax, company pays its own tax)
  business: {
    current: 0, snd: 3.0,            // conventional bank
    wadiah: 0, mudarabaSnd: 2.5      // Islamic bank
  },

  // Goal presets: amount in taka, years
  goals: {
    edu: { amount: 1000000, years: 10 },
    wedding: { amount: 800000, years: 5 },
    hajj: { amount: 700000, years: 5, shariah: true },
    umrah: { amount: 250000, years: 2, shariah: true },
    home: { amount: 2000000, years: 7 },
    retire: { amount: 5000000, years: 20 },
    emergency: { amount: 300000, years: 2 }
  }
};
