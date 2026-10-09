# Zitsy — Brand & SEO Resume Status

Recovery/origin: prior interrupted "Brand Strategy, Audience Positioning, SEO & Organic Marketing Readiness" execution. Status refreshed during a fresh session against the live codebase, `UI-UX-ROUND-2-REPORT.md`, and `UI-UX-ROUND-3-REPORT.md`.

Status legend:
- **DONE** — implemented and verified in this project.
- **PARTIAL** — work exists; remaining requirement noted.
- **NOT STARTED** — no meaningful implementation.
- **BLOCKED** — needs owner decision / external credential.
- **N/A** — intentionally not applicable (recorded why).

## Requirements → status

| # | Requirement | Status | Evidence / notes | Next action |
|---|---|---|---|---|
| 1 | Audience & brand strategy research | **DONE (report) / HYPOTHESES** | No real customer data exists; single-operator brand, no analytics/ads. Strategy written as testable hypotheses, not fabricated facts. | Owner validates via Search Console/GA4 once live; refute/confirm hypotheses. |
| 2 | Visual identity consistency | **DONE (prior rounds)** | R2/R3 verified: green palette (brand tokens + `globals.css` green scale), Fraunces display + Geist body, monogram w/ registration dot, og/icon/favicon/social tiles, deep-green footer bands, AA contrast rules. Uncommitted files from R2/R3 reviewed. | Commit R2/R3 work when ready. |
| 3 | Product catalog & merchandising audit | **DONE** | 25 visible products, 9 derived categories, GBP-only storefront. 4 design-less/base products visible and purchasable (Unisex Heavy Blend Crewneck, Unisex Heavy Blend Hoodie, Cotton Canvas Tote, Blank Canvas "for Printing" Tote) — pixel analysis confirms near-zero print coverage; their supplier descriptions also leak raw HTML. IP-risk SKUs flagged (PlayStation backpack, Fight Club cap, Marceline candle/mug). | Owner: hide/retire design-less SKUs at Printify source (DB hide would be undone by sync). Do not suppress via `visible=false`. |
| 4 | Product copy cleanup (HTML in descriptions) | **IMPLEMENTED** | `src/lib/catalog/description.ts` `toPlainText()` strips block/br tags + entities; applied in `buildProductView` (`src/lib/catalog/view.ts`), so PDP body, meta description, and JSON-LD all use cleaned text. 9 raw-HTML-heavy descriptions cleaned at render boundary; DB untouched. Unit tests `tests/description.test.ts` (7 pass). | — |
| 5 | Technical SEO & structured data | **IMPLEMENTED (incremental)** | Prior: allow-all robots + sitemap, Product JSON-LD, winners elsewhere. This session: added `itemCondition: NewCondition`, brand in Product JSON-LD, BreadcrumbList JSON-LD, category-aware `generateMetadata` for `/shop` (QPs read server-side, canonical collapses sort-only dupes), `/contact` added to sitemap. | Optional later: hreflang/strict canonical re-check after deployment. |
| 6 | Category & internal-link structure | **DONE (structure) / PARTIAL (thin categories)** | Footer category links + home category grid exist. But 3 categories have 1 product each (Backpacks, Hats, Mugs) and Hoodies/Sweatshirts hold design-less base SKUs; no dedicated category landing pages (only `/shop?category=`). | Owner: grow catalog to ≥3 SKUs per thin category before building landing pages; avoid keyword-less thin pages. |
| 7 | UK + Germany localization | **PARTIAL / BLOCKED** | English-only, GBP for both markets by design (single storefront). DE points to `zitsy.example`; store carries correct UK/EU CTR + PayPal. No German Impressum/Widerruf/VAT guidance implemented. Missing legitimate-interest video analytics consent (gap vs. promise). | Owner: confirm UK removable/Directive positioning; decide DE language/legal approach; add consent flow. |
| 8 | Organic marketing strategy + 30-day calendar | **NOT STARTED → DONE (report)** | `BRAND-SEO-MARKETING-READINESS.md` §10. Prioritized to Pinterest + Instagram organic, no paid ads, honest-made-to-order positioning, one design-first + one community play per week. | Execute calendar once live. |
| 9 | Content guidelines | **NOT STARTED → DONE** | `CONTENT-GUIDELINES.md` defines voice/tone, product-feature copy structure, social post structure, image rules (no fake reviews/discounts/proof), claim-verification. | Adopt in practice. |
| 10 | Trust & conversion readiness | **DONE (surfaces) / PARTIAL (email)** | Contact, shipping (no guaranteed times — honest), returns (14-day damage, no change-of-mind), sizing (no universal chart), privacy (UK+DE), terms — all present. Resend wired to `@zitsy.example` placeholder sender/inbox. | Owner: real sender domain + support inbox before go-live. |
| 11 | Analytics & consent | **BLOCKED / N/A** | No analytics, ads, or consent present (verified, matches privacy copy). Owner wants privacy-preserving stack. Email subscribe + GA4 without consent-blocked marketing needs owner decision. | Owner: choose stack (GA4 events only / no tools); add consent. |
| 12 | Experimentation backlog | **DONE (report §12)** | Backlog: short-list blank-test SKU removal, category badges, "Choose your size" inline sizing, printfulness experiment, featured-set review (hero+falls back to cheap items), canonicals after launch, review-snippet eligibility. | Triage post-launch. |
| 13 | `BRAND-SEO-MARKETING-READINESS.md` | **DONE** | File exists; 14 tagged sections; each claim marked with evidence or NOT VERIFIED. | — |
| 14 | `CONTENT-GUIDELINES.md` | **DONE** | File exists; voice + templates + image/claims rules. | — |
| 15 | Quality gates | **RUN** | `pnpm typecheck`, `pnpm lint`, `pnpm test` (337 baseline + 7 new), `pnpm build`, `pnpm test:e2e` — see Results below. | — |

## Actual gate results (run during this resume)

- `pnpm typecheck`: **PASSED** (no errors)
- `pnpm lint`: **PASSED**
- `pnpm test`: **PASSED** (baseline 337 + 7 new description tests = **344**)
- `pnpm build` (with `NEXT_PUBLIC_APP_URL=https://zitsy.example`): **PASSED**
- `pnpm test:e2e`: **PASSED** (11/11)

## Files changed/created during this resume

- Created: `BRAND-SEO-MARKETING-READINESS.md`, `CONTENT-GUIDELINES.md`, `ZITSY-BRAND-SEO-RESUME-STATUS.md`, `src/lib/catalog/description.ts`, `tests/description.test.ts`
- Modified: `src/lib/catalog/view.ts`, `src/app/(storefront)/product/[slug]/page.tsx`, `src/app/(storefront)/shop/page.tsx`, `src/app/sitemap.ts`, `src/app/(storefront)/page.tsx` (copy fix)
- Deleted: temp `inv-tmp.ts` (never committed)

## Blocker / owner-action register

1. Printify source: hide 4 design-less SKUs (or build designs for them). Local DB hide would be reverted by sync.
2. Real sender + support mailbox instead of `@zitsy.example`.
3. Consent + analytics stack decision (no tools today).
4. German localization / legal (Impressum, Widerruf, VAT) — owner decision.
5. IP-risk SKUs (PlayStation, Fight Club, Marceline) — legal review or retire.
6. Domain choice + go-live, then Search Console + GA4 setup to confirm hypothesis tags.