# WealthLens — savings calculator

A bilingual (Bangla first, English switch) calculator that compares FDR, DPS, Sanchaypatra, Mudaraba deposits and Shanta Asset Management Limited's funds after tax. Built for Mehedi Hasan, Financial Planner.

**Tabs:** Compare · My goal · Save tax · Business cash · Know the options
**On every tab:** Shariah-only (interest-free) switch, WhatsApp button, lead form. Compare and Goal also make a picture to share.

It is a plain static site (HTML, CSS, JavaScript). No build step, no server.

---

## 1. Put it online with Vercel (one time, about 10 minutes)

1. Create a free account at **github.com**.
2. Click **New repository** → name it `wealthlens` → Public or Private → **Create**.
3. On the new repo page click **uploading an existing file**, select **all the files** in this folder (there are no sub-folders, so this works from a phone too), then **Commit changes**.
4. Go to **vercel.com** → **Sign up with GitHub**.
5. **Add New → Project** → pick `wealthlens` → **Deploy**. Leave every setting as it is.
6. Vercel gives you a link like `your-project.vercel.app`. That is your site.
7. Open `config.js`, set `siteUrl` to that exact address, and commit. (It appears on the share picture and the WhatsApp preview.)

Optional: in the Vercel project, open **Analytics → Enable** to see how many people visit and from where.

From now on, every change you commit on GitHub goes live on Vercel within a minute.

## 2. Update rates (after every budget, or when bank rates move)

Everything lives in **`config.js`**. Each value has a comment.

| What | Where in `config.js` |
|---|---|
| FDR / DPS rates | `instruments.fdr.rate`, `instruments.dps.rate` |
| Sanchaypatra rates | `instruments.sanchay` (`rate`, `rateHigh`, `earlyRates`) |
| Fund return ranges | `instruments.sfif/sfiuf/sasf` → `low`, `high` |
| Fund past returns (Know the options tab) | `instruments.*.past` |
| Mudaraba rates | `instruments.mtd.rate`, `instruments.mdps.rate` |
| Tax slabs, rebate rule | `tax` |
| Bank excise duty slabs | `excise` |
| Your photo (optional) | add a square photo as `advisor.jpg` to show it; without the file, no photo appears |
| Your name / WhatsApp / Facebook link | `advisor` (put your Facebook link in `facebook` and the button appears) |
| Date shown at the bottom | `lastUpdated` |

All words on the page are in **`i18n.js`** (`bn` and `en`). Change wording there.

## 3. Leads

The form sends each lead to your WhatsApp: the visitor enters name, phone and topic, taps **WhatsApp-এ পাঠান**, and WhatsApp opens with their details and calculation already typed in. They just tap Send.

## 4. Before sharing publicly

- **Compliance:** ask SAML's compliance team to approve the page, especially the 12–15% expected return used for First Income Unit Fund and Amanah Shariah Fund. Their published since-launch returns are lower than that, and both are shown on the "Know the options" tab. Shanta Fixed Income Fund uses SAML's own fact-sheet figure (10–12.5%).
- **Tax:** figures follow the Finance Act 2026 as reported publicly. The women/65+ threshold (৳4,25,000) and the DPS yearly limit vary between sources; confirm with a tax adviser.
- **Bank rates** are typical market figures and differ by bank. Islamic bank Mudaraba rates are provisional.

## How the numbers are worked out

- **FDR:** 1-year FDR renewed every year with profit, tax cut each year. Broken early → `breakRate` for the unfinished months.
- **DPS:** monthly instalments, monthly compounding, tax on profit at maturity. Closed early → no profit within 12 months, `breakRate` after.
- **Sanchaypatra:** 3-month-profit scheme, 3-year term, renewed. The 3-monthly profit is paid out and NOT reinvested (that is what most holders do), so it adds up but does not compound. Cashed early → the `earlyRates` table.
- **Tax on profit:** the higher of your bracket and the 10% cut at source.
- **Funds:** grow at the `low` and `high` yearly rates; at most 4.5% of the gain goes to tax (15% on up to 30% paid as dividend). No exit penalty.
- **Tax rebate:** the lowest of 3% of taxable income, 10% of eligible investment, ৳7.5 lakh, and never below the ৳5,000 minimum tax.
- **Bank excise duty** (FDR, DPS, Mudaraba deposits): charged once a year on the account balance, using the `excise` table in `config.js`.
- **Shown for every option:** net yearly return after all costs, tax deducted, excise duty, cost of breaking early (only when the person withdraws before their plan ends), and the value in today's money after inflation.

## Files

`index.html` page · `styles.css` design · `app.js` calculations and behaviour · `config.js` rates and your details · `i18n.js` all wording · `qrcode.js` QR code maker (MIT licence, by Kazuhiko Arase) · `favicon.png` icon · `og-image.png` picture shown when the link is shared.
