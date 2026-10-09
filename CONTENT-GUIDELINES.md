# Zitsy Content Guidelines

Voice, tone, framing, and structure rules for every customer-facing word — metadata, product copy, social posts, and email. These are the practical expression of the brand strategy in `BRAND-SEO-MARKETING-READINESS.md`.

## 1. Positioning line

**"Good things, made when you want them."** — honest, quiet, warm, and slightly wry. Zitsy sells small-run graphic apparel and lifestyle goods that are printed to order. We never claim customisation, fake stock, fake urgency, fake reviews, or discounts we can't honour.

## 2. Voice anchors

| Anchor | Means | Example tone |
|---|---|---|
| Quiet | No shouting, no caps, no exclamation spam | "A low-profile tee that speaks softly." |
| Warm | Genuine, human, friendly | "Comfortable enough to become a favourite." |
| Dry humour | Light wry wink, never forced | "Ctrl + Z doesn't work in real life." |
| Plain English | Short sentences, concrete words | "100% cotton. Medium weight. No side seams." |
| Honest | Every claim verifiable or removed | Never "premium" without evidence; never "guaranteed delivery". |

**Never:** hype words ("revolutionary", "best seller", "must-have"), invented scarcity ("only 3 left"), fake social proof ("5.0 stars, 1,200 reviews"), unverified eco/ethical claims.

## 3. Product copy structure (cleaned descriptions)

1. **One-line feeling** — what it is and how it sits with the wearer's life.
2. **Fabric / materials** — concrete specs (weights, blends) when known; omit when unknown.
3. **Features** — what the buyer actually controls (fit, care, print placement honesty).
4. **Verifiable claims only** — if ink/print method is known, say it; otherwise don't.

Product descriptions are stored via Printify sync; the storefront renders them through `toPlainText()` (`src/lib/catalog/description.ts`), so supplier HTML is stripped to clean text. **Do not write markup into DB copy — plain text with blank lines only.**

## 4. Social post structure

Every Pinterest/Instagram post follows:

- **Hook (1st line):** the feeling, not the promo. e.g. "A tee for the quiet mornings you carry with you."
- **Body (2–3 lines):** one concrete detail (fabric, print, inspiration). e.g. "Mountain silhouette, chest-sized, cotton that drapes."
- **Call to action:** gentle and honest — "Made to order at zitsy.com" (no fake urgency, no countdown).
- **Hashtags:** 3–6 tight, platform-relevant tags (e.g. `#madeToOrder #minimalTee #smallShop #ukmade` — only verified true).
- **Image text:** ≤ 8 words, readable at 200px, on-brand green.

## 5. Pinterest specifics

- Standard pin: 1000×1500 (2:3). Story pin: 1080×1920.
- First board promoted: **"Quiet graphic tees"** + **"Made to order small shops"**.
- Use existing product mockups (1200×1200) + brand tile crops; no watermark over print.

## 6. Instagram specifics

- Feed: 1080×1350 (4:5). Reel: 1080×1920 9:16 or hd.
- Reels (when started): 5–15s, print close-up, packaging, "how it's made" honest snippets.
- Stories: daily recs + answered Q&A; no pressure CTAs.

## 7. Email strings (all owner-verified before send)

From-name/address must be a real domain, not `@zitsy.example`. Subject lines: ≤ 45 chars, plain, no all-caps, no "!!". Order emails: confirmation (factual), shipping update (factual), no "you'll lose it" cross-sell. Any sale/discount must be real and time-bounded with a date.

## 8. Accessibility & platform rules

- All product images need meaningful alt text (title-based, describing print, not "image.jpg").
- Caption text: minimum 4.5:1 on brand surfaces (use brand tokens; `muted` must stay WCAG AA).
- No auto-play sound, no flashing, no GIFs with seizure risk in body content.
- Respect community guidelines: no IP-baiting (PlayStation/Fight Club/Marceline content held for owner legal review before use).

## 9. Approval checklist (pre-publish)

- [ ] Every factual claim verifiable (fabric, weight, print, process, timeline).
- [ ] No fake reviews, scarcity, or urgency.
- [ ] Spelling/grammar pass; plain English, one exclamation max.
- [ ] Image text readable at 200px; on-brand.
- [ ] Owner-approved (single-operator store — owner is final editor).
- [ ] If it mentions GDPR/consent or German legal terms, version approved by owner first.