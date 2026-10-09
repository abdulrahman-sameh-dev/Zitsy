# Zitsy UI-UX — Round 3 (Product card redesign + homepage image crop fix)

Scope: redesign the shared product card (editorial, consistent with the Round 2
green identity) and **fix the homepage product images that appeared partially
hidden or incorrectly framed**, by actually reproducing and measuring the problem
in the rendered app rather than assuming the Round 2 square/`object-contain`
reading fixed it. All changes are implemented directly in the app (no mock-up
drift) and verified with a real catalog + Playwright geometry/pixel checks and the
full regression gate.

Root cause of the reported "partially hidden images" was **found, not assumed** —
and it was not the product card itself.

---

## 1. Root cause, diagnosed in the rendered homepage

The homepage has two product-image surfaces:

1. **Featured products** (grid of `ProductCard`, `lg:grid-cols-6`) — was already
   geometrically correct: square frame, `object-contain`, never crops.
2. **Shop by category** (grid of 4:3 `object-cover` tiles) — **this was the bug.**

Measured in the running app (Playwright + raster analysis of the real 1200×1200
mockups, dev DB catalogue):

| Category tile | Tile box | Frame type | Source | Result |
|---|---|---|---|---|
| T-Shirts, Hoodies, Tote Bags, Sweatshirts, Mugs, Backpacks, Hats, Stickers, Candles | `290×218` (4:3) | `object-cover` | square `359×359` (`1200×1200`) | **~12% of image height cropped off the top AND bottom** |
| Garment cut (natural px) | | | | T-Shirts top 44 / Hoodies 46 / Tote Bags 53 / Sweatshirts 37 / **Backpacks 149** / Mugs 10 / Hats 11 |

`object-cover` scales the square mockup to fill the landscape tile, so the top and
bottom of the garment (and, for backpacks, head/shoulder area) run off the tile.
That is exactly the "product looks partially hidden / incorrectly framed" symptom.

The featured cards were not the culprit — but they had a secondary *framing* flaw
worth correcting (below).

### 1a. Secondary flaw on the product card: inert padding

The card's `p-5` gutter had **no visual effect**: with `next/image fill` (absolute
positioned), the image covers the entire padded box, so garments rendered
edge-to-edge against the tile with no breathing room, and the intended "print
tile" reading never landed. Confirmed by DOM geometry (`img box` = full tile, no
inset).

---

## 2. Changes

### 2a. Product card — `src/components/storefront/product-card.tsx` (redesigned)

- **Editorial layout**: square **brand-50 print tile** on top; then a category
  **eyebrow** (uppercase, `text-brand-700`, AA on white), the product title
  (2-line clamp), and a footer row with the **real price** (brand-800) and an
  always-visible **"View →"** affordance with arrow.
- **Framing fix**: the image sits inside a real inner inset
  (`absolute inset-[6%]`) so **every** product — sticker, mug, tote, tee, cap,
  candle, backpack, hat — gets uniform breathing room and is never cropped:
  - Desktop homepage card: tile `177×177`, image box `155×155` (11 px inset each
    side, ≈6%). Verified via DOM bounding boxes.
  - `object-contain` is unchanged and mathematically guarantees the whole mockup
    (garment + print) stays visible at any card size.
- **No hover-only essentials**: the previous floating "View" pill (`opacity-0`,
   hover-only) and the artwork-overlapping category chip are gone. The whole card
   is a single link; category, title, price and the "View →" affordance are all
   visible and reachable by keyboard (verified: Tab focuses the first card and the
   accessible name reads eyebrow + title). Focus ring = global brand-700
   `:focus-visible`.
- **Reduced motion**: the hover zoom on the artwork is gated by
  `motion-safe:group-hover:scale` and the global `prefers-reduced-motion` override
  collapses all transitions to ~0 ms.
- **No quick-add added** (variant selection is required for a real order; an
  auto-sizing quick-add would violate the honest-variants contract).
- Card chrome: `rounded-2xl`, hairline `border-line`, hover lift + brand-300
  border + soft deep-green shadow (respects the green identity, no gradient-food).

### 2b. Category grid — `src/app/(storefront)/page.tsx`

- Tiles changed from `aspect-[4/3]` + `object-cover` (the crop) to
  **`aspect-square` + `object-contain`** inside the same 6% inset, on brand-50 —
  identical language to the product card. No more crop:
  - Desktop: tile `290×290`, image box `255×255` (17–18 px inset, ≈6%).
  - 375 / 768 / 1440: verified **no horizontal overflow** on `/` and `/shop`.
- `CategoryGridSkeleton` updated to the square brand-50 tile (no layout shift on
  hydration).
- Remainder of homepage (`HeroSkeleton`, featured grid, trust band, deep-green
  footer band) unchanged — Round 2 composition holds.

### 2c. Skeleton consistency — `src/components/storefront/product-grid-skeleton.tsx`

- Tile changed `bg-canvas` → `bg-brand-50` and card to `rounded-2xl` so skeletons
  match the redesigned card precisely.

No other surfaces needed the crop fix; the only remaining `object-cover` in the
codebase is a `56×56` tracking thumbnail (square source in a square box → no crop).

---

## 3. What was actually inspected (limitation disclosed)

Per the standing limitation, the agent **cannot visually render screenshots**, so
no "looks good on a phone" claim is made. Instead, verification was done on the
rendered app with Playwright and raster analysis of the **real** Printify mockups:

- **Geometry (conclusive)**: measured DOM bounding boxes for every card on `/` and
  `/shop` at 375, 768, 1440 — image box inset ≈6% on all four sides, tile square,
  computed `object-fit: contain`. With a square source in a square contain box the
  entire mockup is rendered whole by construction.
- **Raster (category crop — conclusive)**: garment bounding box extracted from the
  actual 1200×1200 sources; computed the `object-cover` crop window vs. the frame
  and showed the garment is cut (see §1 table). After the fix the same math shows
  zero crop.
- **Interaction (conclusive)**: keyboard-focus reaches the first card, the
  accessible name is complete, and the price/label survive without hover.
- Screenshots were captured to `/tmp/opencode/round3/` (`home.png`,
  `page-375/768/1440.png`, `page-shop375.png`) for the owner to eyeball; pixel
  bounding-box checks on those tiles were partially confounded by card border
  antialiasing at corners, so the DOM geometry is treated as the authority here.

---

## 4. Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 0 warnings |
| `pnpm test` | ✅ 33 files, **337 tests** passed |
| `pnpm build` | ✅ 26 routes (`NEXT_PUBLIC_APP_URL=https://zitsy.example`) |
| `pnpm test:e2e` | ✅ **11/11** passed (32 s) |
| Overflow / framing at 375/768/1440 | ✅ none (home + shop), cards inset ≈6%, no crop |

---

## 5. Files changed (Round 3)

- `src/components/storefront/product-card.tsx` — redesign (inset framing, eyebrow,
  always-visible price + "View →", motion-safe hover, rounded-2xl).
- `src/app/(storefront)/page.tsx` — category grid crop fix (square + contain),
  skeleton sync.
- `src/components/storefront/product-grid-skeleton.tsx` — matches new card tile.

(`UI-UX-ROUND-2-REPORT.md` and `UI-UX-REPORT.md` unchanged; the Round 2 green
identity is the baseline this round builds on.)

---

## 6. Unresolved / notes

- The intermittent Printify CDN 400s (§15 of Round 2) remain an upstream/rate watch
  item; server-rendered pages are unaffected.
- The card could later gain a secondary hover zoom on desktop (PDP already has
  one); deliberately not added here to keep cards predictable and fast.
- `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` are
  uncommitted deletions from earlier rounds — unrelated to Round 3 (not touched).