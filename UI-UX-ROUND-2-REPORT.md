# Zitsy UI-UX — Round 2 (Green identity)

Follow-up pass to the original [UI-UX-REPORT.md](./UI-UX-REPORT.md). Scope: a second,
deliberate design refinement driven by the `ui-ux-pro-max` skill and the owner's
green palette. Implements the chosen direction **directly in the app** (no mock-up
drift), then verifies with automated layout/contrast/interaction checks.

This report supersedes the orange-era conclusions of the first report. Verified
facts are separated from assumptions throughout.

---

## 1. Palette — exact Tailwind v4 green scale

The design-system search returned the skill's stock suggestion ("Liquid Glass",
black + gold). That is **not** the brief: the owner supplied the authoritative
palette (Tailwind v4 `green`) and it is applied verbatim, without emerald/mint/lime
substitution.

`src/app/globals.css` `@theme` `--color-brand-*` is now the exact scale:

| Token | Hex |
|---|---|
| brand-50 | `#f0fdf4` |
| brand-100 | `#dcfce7` |
| brand-200 | `#b9f8cf` |
| brand-300 | `#7bf1a8` |
| brand-400 | `#05df72` |
| brand-500 | `#00c950` |
| brand-600 | `#00a63e` |
| brand-700 | `#008236` |
| brand-800 | `#016630` |
| brand-900 | `#0d542b` |
| brand-950 | `#032e15` |

Contrast decisions (computed, WCAG 2.1):
- **White on brand-600 = 3.22:1** → fails AA for small text, so brand-600 is
  decorative **only**. Every action button uses **brand-700** (white text 4.95:1)
  with brand-800 hover (7.13:1). This reversed the previous round's brand-600 buttons.
- Links/text on light surfaces use brand-700/800 (4.95 / 7.13:1).
- Text/icons on deep bands use brand-100/brand-200/brand-300/brand-400
  (brand-300 on brand-950 = 10.67:1; brand-400 = 8.40:1).
- Non-text elements (focus outline, swatch rings, borders) may use brand-500+.

Applied classes: `.btn-primary` (brand-700/800), `.chip`/`.chip-active`, `.btn-secondary`,
`.prose-doc` links, `:focus-visible` outline, product/checkout/tracking/cart/contact/
search/error/not-found buttons and progress dots — all swept from brand-600 to brand-700.
The 11-steps of `--color-brand-*` stay defined so Tailwind utilities resolve.

## 2. Logo & brand assets

`src/components/brand/logo.tsx` `LogoMark` is redrawn as a green screen-print
monogram: rounded triangle-free tile in brand-700, a bold white "Z" with round caps
and joins, plus a small brand-50 **registration dot** (a nod to screen printing) in
the tile's top-right. Wordmark stays Fraunces. Mark color `text-brand-700`; it is
legible on white, brand-50, brand-900 tile and brand-950 footer bands.

`scripts/generate-brand-assets.py` updated to the same monogram and green palette and
regenerated deterministically (draws primitives, no downloads):
- `src/app/icon.png` (192), apple-icon.png (180), `public/favicon.ico` (16/32/48)
- `public/og.png` — 1200×630 on brand-950 with brand-800 tile echo, "zitsy · Easy as
  Zitsy · made to order" and "ships to GB · DE"

## 3. Homepage hero — Dragon sweatshirt spotlight

The hero is rebuilt as a deep-green (`brand-950`) editorial panel with a faint
print-register dot texture, a brand-400 status dot, and the creative product as the
visual centre. Rationale: the sweatshirt mockup is a **white Canadian-canvas**
garment with a bold black vertical-dragon graphic — highest contrast of any hero
candidate and honest (no fabricated product photography).

- Product: `dragon-silhouette-sweatshirt-vertical-flying-dragon-minimal-black-grap`
  (25 visible products confirmed in the catalog; slug-availability is gracefully
  handled — `getHeroProductSummary` falls back to the computed featured product).
- Headline kept: "Good things, made when you want them."
- Chip now reads **"Made to order · Ships to GB & DE"** (replaces "Printed to order").
- CTA row: `Shop everything` (primary) + `Track your order` (ghost on the dark band).
- Info chips: category (Sweatshirts) + real **From £18.99** price from DB.
- Object-contain framing: the 1200×1200 mockup is shown whole on `brand-900` tile,
  so the garment and print are never cropped.

## 4. Product cards

`src/components/storefront/product-card.tsx`:
- Square frame on **brand-50** with an inset `p-5` gutter (`object-contain`) — a
  "print tile" reading; the garment floats whole, never cropped to cover-fit.
- Hover: lift + border brand-500 + faint garment scale; restrained "View" pill appears
  on hover (pointer-capable). No quick-add — every product needs a variant selection,
  and a fake quick-add would break the honest-variants contract.
- Category chip recolored brand-50/brand-200/brand-800.
- Same card is used by home, `/shop`, `/search`, category grid and the PDP "You may
  also like" row, so framing is consistent everywhere.

## 5. Gallery — curated, colour-aware, no giant grids

New pure module `src/lib/catalog/gallery.ts` (unit-tested, no I/O) plus a reworked
`product-view.tsx` client gallery:

- **Initial load is curated**: instead of dumping every mockup (the dragon-silhouette
  *tee* has 234 images), the active colour shows `distinctAngles(...)` — one
  representative per camera bucket (front, back, open, folded, hanging, lifestyle,
  person, detail, size-chart) capped at 12. Verified: 7 thumbnails render, not 234.
- **One representative thumb per available colour** acts as the colour selector
  (role=option + aria-selected), driven by the DB colour dimension (`type ===
  "color"`) and the variant→image mapping (`ProductImage.variantIds`), so it can never
  show a colour the product isn't made in.
- **Choosing a colour swaps the mockup set** to that colour's images; the selected
  colour's name is echoed beside the swatch row.
- Products without a colour dimension fall back to the existing `imagesForVariant`
  set, capped to 8.
- **Colour → size sync**: `suggestCompatibleSize` never silently keeps an impossible
  size — colour switch corrects the size to that colour's first available size.
- Existing tests `tests/images.test.ts` / `catalog-view.test.ts` still pass; new
  `tests/gallery.test.ts` (10 tests) covers colour grouping, unavailable colours,
  hero image selection, angle dedupe/cap, size correction, swatch mapping.

## 6. Zoom — desktop hover lens + mobile lightbox

- **Desktop (hover-capable devices only** via `(hover:hover) and (pointer:fine)`):
  mousemove sets transform-origin; the *same* `next/image` scales to 2.2× inside the
  `overflow-hidden` frame — no extra network fetch, no fake high-res swap. A small
  "Hover to zoom" hint shows only when applicable; cursor is `zoom-in`.
- **Touch / keyboard**: "Expand" opens the existing `<dialog>` modal; a **"Zoom to
  1:1"** toggle pans a real-pixel view inside an `overflow-auto` container, plus
  Fit/Escape close. State reset on dialog close.
- Automated check confirmed the hover scale applies client-side (computed transform
  ≠ none after pointer move on a desktop viewport).

## 7. Variant selection & price honesty

- Colour is selected in the gallery swatches; other dimensions (sizes) stay in the
  buy-box chips with `availableValueIdsForDim` disabling cross-dimension impossibilities.
- Price shows real variant price when a full selection resolves; otherwise "From £X";
  never £0.00, never an impossible combination.
- Add-to-cart gated on a resolvable orderable variant; payload unchanged
  (productId + variantId + quantity) so cart/checkout/PayPal flows are untouched.

## 8. Copy accuracy ("Made to order", not "custom uploads")

- Store is **pre-designed catalogue only** — there is no upload/custom-artwork flow
  in the codebase, so every claim now matches reality:
  - Hero chip, footer tagline, shop/sizing/about/shipping copy, layout metadata and
    the PDP trust block all say **"made to order"** (was "printed to order").
  - PDP trust block states plainly: "…pre-designed style: choose your colour and
    size, there is no custom upload."
- **Raw Printify marketing tags removed from the PDP tag list** (they described
  provider capabilities, not the garment): `src/lib/catalog/tags.ts` `displayTags`
  filters TikTok, New Mockups, Personalization Picks, Glitter/Glitter print,
  Puff/Puffy/Puff print, Metallic, Embroidery/Embroidered, Holographic, Foil, Raised/Textured
  print. Search and category derivation still index the raw tags — only the display
  is filtered. Tested in `tests/tags.test.ts`.

## 9. Consistency sweep

- Footer and trust band moved from ink (`#1a1916`) to **deep green** (`brand-950` =
  `#043019` via `--color-card-dark`; divider `--color-card-dark-line` `#0c4a28`), so
  `muted-light` text stays ~9.6:1.
- `public/og.png`, icon/apple-icon/favicon all green monogram; hero, footer, buttons,
  focus, selection, breadcrumb hovers, progress steps all consistent.
- E2E footers still expose exactly "Track Order" → /track-order and "Contact Us" →
  /contact (navigation spec passes).

## 10. Email configuration & owner actions (findings — not code bugs)

Verified from code + `.env`:

| Concept | Config | Current value |
|---|---|---|
| Resend API key | `RESEND_API_KEY` | present (`re_…`, masked) |
| Sender identity | `EMAIL_FROM` | `Zitsy <orders@zitsy.example>` |
| Store support inbox / admin recipient | `SUPPORT_EMAIL` | `store@zitsy.example` |
| Contact reply-to | `src/lib/contact/service.ts:132` | the customer's email |

`emailConfig()` (src/lib/email/config.ts) distinguishes **sender** (`from`) from
**support inbox** (`supportRecipient`); the contact form sets `replyTo` to the
customer's address so replies land with the right person. Sending auto-disables in
production when the public URL is localhost (by design).

**Owner to-do before real customers** (external setup, nothing to code):
1. Register a real domain on Resend and verify the domain's DNS.
2. `EMAIL_FROM` → a verified sender, e.g. `Zitsy <orders@zitsy.com>`.
3. `SUPPORT_EMAIL` → a real inbox (or a forwarding rule from `store@` to the staff
   inbox). The `*.example` addresses are placeholders and currently cannot receive mail.

## 11. Custom artwork — feasibility note

Not supported today, and no UI claims otherwise. If "upload your own" is ever added,
a realistic requirement set: file upload with size/type/dimension validation and
secure storage, print-area compatibility with each garment, print-details preview +
approval flow, per-design pricing, copyright/abuse screening, fulfilment metadata and
support handoff. Recommending this stays a documented future feature, not a silent
half-implementation.

## 12. What was inspected vs. assumed

Honesty note: the agent **cannot see rendered images.** Pixel-level visual QA was not
performed. Instead, geometry and behaviour were verified programmatically (Playwright,
dev server, real catalog data — 20/20 checks):

- No horizontal overflow at 375 px and 1440 px across `/`, `/shop`, the Dragon PDP,
  `/cart`, `/track-order`, `/contact`.
- Hero panel computed to `rgb(3,46,21)` (brand-950); footer `rgb(4,48,25)`.
- Gallery curated (7 thumbs), colour swatches with aria-labels, colour switch keeps a
  loadable hero mockup and marks the picked swatch.
- Lightbox opens on mobile with working zoom-to-1:1 toggle.
- Hover zoom applies a computed scale transform on a desktop viewport.
- Add-to-cart fills brand-700 after selecting a size; card tiles are brand-50 with a
  `20px` inset.
- PDP: "made to order" present; no TikTok/New Mockups/Glitter/Puff/Embroidery in the tag
  list.

Prior round's raster analysis stands: all mockups are 1200×1200 RGB with the garment
centred at ~72–83% of the frame on white backgrounds, which is exactly why
square + object-contain + tinted tile is the correct framing.

## 13. Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 0 warnings |
| `pnpm test` | ✅ 33 files, **337 tests** passed (324 prior + 10 gallery + 3 tags) |
| `pnpm build` | ✅ 26 routes (run with `NEXT_PUBLIC_APP_URL=https://zitsy.example`, the established non-localhost guard value) |
| `pnpm test:e2e` | ✅ **11/11** passed (24 s) |
| Programmatic UX checks | ✅ 20/20 |

## 14. Files changed

- `src/app/globals.css` — green scale tokens, dark bands, button/chip/prose/focus classes
- `src/components/brand/logo.tsx`, `scripts/generate-brand-assets.py` (+ regenerated
  icon/apple-icon/favicon/og) — green monogram
- `src/lib/catalog/gallery.ts` (+ `tests/gallery.test.ts`) — colour gallery model
- `src/lib/catalog/tags.ts` (+ `tests/tags.test.ts`) — display-tag filter
- `src/lib/catalog/query.ts` — `getHeroProductSummary`
- `src/components/storefront/product-view.tsx` — curated gallery, swatches, colour↔size
  sync, zoom + lightbox, brand-700 buttons, made-to-order copy
- `src/components/storefront/product-card.tsx` — square brand-50 tile, contain, View affordance
- `src/app/(storefront)/page.tsx` — Dragon hero + green bands + made-to-order copy
- `src/app/layout.tsx`, `src/app/(storefront)/{about,shop,sizing}/page.tsx`,
  `src/components/storefront/footer.tsx` — made-to-order copy
- `src/app/(storefront)/product/[slug]/page.tsx` — filtered tag list
- Button fills brand-600→brand-700 across `error`, `not-found`, `search`, `checkout/*`,
  `track-order*`, `cart-view`, `header`, `contact-form`, `checkout-form`, plus
  focus outline and remaining brand-600 accent → brand-700.

## 15. Unresolved / notes

- Mockup image fetch intermittently returns 400 from Printify CDN for a few products
  (observed in dev logs for a sticker and a candle); server-rendered pages are
  unaffected — an upstream/rate behaviour to watch, not a code regression.
- `next start` staging server observed on port 3410 (pre-existing) — untouched.
- Full resync of the catalog would keep colour/gallery mapping source-of-truth
  aligned (single source: `ProductImage.variantIds` + variant `optionValueIds`).