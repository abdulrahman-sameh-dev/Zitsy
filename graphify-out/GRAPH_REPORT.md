# Graph Report - zitsy  (2026-10-07)

## Corpus Check
- 164 files · ~63,089 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 870 nodes · 2042 edges · 45 communities (39 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47f5cc07`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `PrintifyClient` - 26 edges
2. `log` - 20 edges
3. `formatMoney()` - 20 edges
4. `compilerOptions` - 16 edges
5. `captureOrderPayment()` - 15 edges
6. `ServerEnv` - 15 edges
7. `submitContactMessage()` - 14 edges
8. `renderEmail()` - 14 edges
9. `getPrintifyClient()` - 13 edges
10. `PrintifyOrder` - 13 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `syncCatalog()`  [EXTRACTED]
  scripts/printify-sync.ts → src/lib/catalog/sync.ts
- `main()` --calls--> `appUrl()`  [EXTRACTED]
  scripts/printify-sync.ts → src/lib/config/env.ts
- `main()` --calls--> `getPrintifyClient()`  [EXTRACTED]
  scripts/printify-sync.ts → src/lib/printify/client.ts
- `evaluate()` --calls--> `evaluateProfitability()`  [EXTRACTED]
  tests/profitability.test.ts → src/lib/checkout/profitability.ts
- `startOrder()` --calls--> `beginCheckout()`  [EXTRACTED]
  tests/checkout-service.test.ts → src/lib/checkout/service.ts

## Import Cycles
- None detected.

## Communities (45 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (22): appUrl(), emailFrom(), formatIssues(), integrations, optionalString, parse(), PublicEnv, publicRaw (+14 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (52): CategoryRule, CategorySummary, deriveCategoryForProduct(), DerivedCategory, PRIORITY, slugify(), summarizeCategories(), getCategorySummaries() (+44 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (37): toSlug(), uniqueSlug(), variantDisplayTitle(), variantOptionTitle(), message(), syncCatalog(), SyncSummary, Tx (+29 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (11): GET(), cronSecret(), CronAuthResult, verifyCronAuth(), GET(), fulfillPaidOrder(), cronSecret, syncCatalog (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (42): dependencies, clsx, dotenv, next, @prisma/adapter-pg, @prisma/client, react, react-dom (+34 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (26): storeCurrency(), storeFxRatesSpec(), storeMarkupPercent(), convertMinor(), fxRate(), FxRateError, parseFxRates(), cachedRates (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (25): 10. Environment variables (canonical, no aliases), 11. Phase gates, 12. Progress log, 1. Critical flow, 2. Stack, 3. Project structure, 4. Data model (Prisma), 5. State machines (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (44): ActionResult, addToCart(), clearCartAction(), owningCartId(), removeCartItem(), revalidateCart(), toResult(), updateCartItem() (+36 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (18): NotFound(), toOrderEmailModel(), countryName(), buildSteps(), findOrderByTrackingToken(), isValidTrackingToken(), ORDER_STATUS_LABELS, PAYMENT_LABELS (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (12): globalSetup(), globalTeardown(), CAPTURE_FILE, CapturedEmail, extractTrackUrl(), readCapturedEmails(), startStub(), stopStub() (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (12): PaypalCapture, PaypalCreateOrderInput, PaypalGateway, PaypalLink, PaypalMoney, PaypalOrder, PaypalVerifyWebhookInput, PaypalVerifyWebhookResult (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.50
Nodes (3): nextConfig, privateOrderHeaders, securityHeaders

### Community 21 - "Community 21"
Cohesion: 0.09
Nodes (22): CustomerInput, customerSchema, parseCustomer(), AddressErrorReason, AddressValidation, AddressValidationFail, AddressValidationOk, buildPrintifyAddress() (+14 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (21): assertProfitable(), beginCheckout(), BeginCheckoutArgs, BeginCheckoutResult, CheckoutLine, createLocalOrder(), OrderSummary, prepareCheckout() (+13 more)

### Community 23 - "Community 23"
Cohesion: 0.24
Nodes (13): readCartTokenHash(), beginCheckoutAction(), BeginCheckoutActionResult, captureCheckoutAction(), CaptureCheckoutActionResult, quoteCheckoutAction(), QuoteCheckoutActionResult, toMessage() (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (37): contactUrl(), DATE_FORMAT, formatDate(), formatDateTime(), renderEmail(), TIME_FORMAT, EmailOrderItem, OrderEmailAddress (+29 more)

### Community 25 - "Community 25"
Cohesion: 0.23
Nodes (15): captureOrderPayment(), confirmCapturedPayment(), extractCapture(), findOrderIdByPaypalOrderId(), isAlreadyCapturedError(), markOrderPaid(), markPaymentFailed(), verifyCaptureAgainstOrder() (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.10
Nodes (35): notifyOrderDelivered(), notifyOrderShipped(), notifyOrderSubmitted(), runNotification(), ClassifiedPrintifyError, classifyPrintifyError(), FulfillmentError, FulfillmentErrorCode (+27 more)

### Community 27 - "Community 27"
Cohesion: 0.31
Nodes (8): evaluateProfitability(), finiteNonNegative(), ProfitabilityConfig, ProfitabilityInput, ProfitabilityReason, ProfitabilityResult, CONFIG, evaluate()

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (10): NotifyOrder, resolveImageUrl(), sendOrderEmail(), EmailKind, orderEmailKey(), OrderEmailKind, fakeClient, seedPaidOrder() (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.60
Nodes (4): getOrderSummary(), fulfillmentLabel(), CheckoutSuccessPage(), metadata

### Community 31 - "Community 31"
Cohesion: 0.16
Nodes (11): printifyCostCurrency(), printifyActualShippingMinor(), PrintifyShippingSource, reconcilePrintifyShipping(), ShippingReconcileStatus, ShippingReconciliationResult, emit(), Level (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.39
Nodes (7): assertOrderTransition(), canTransitionOrder(), canTransitionPayment(), isPaidOrderStatus(), isPayableOrderStatus(), ORDER_TRANSITIONS, PAYMENT_TRANSITIONS

### Community 33 - "Community 33"
Cohesion: 0.08
Nodes (21): geistMono, geistSans, metadata, sitemap(), loadCartCount(), listSitemapProducts(), CheckoutForm(), CheckoutFormProps (+13 more)

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (18): EmailTransport, getEmailTransport(), OutboundEmail, EmailSendError, sanitizeEmailError(), SECRET_VALUES, claimDedupeKey(), EmailSendOutcome (+10 more)

### Community 36 - "Community 36"
Cohesion: 0.16
Nodes (15): extractResource(), handleOrderEvent(), handleProductEvent(), isFullProduct(), message(), orderResult(), processPrintifyWebhook(), ResourceRef (+7 more)

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (11): buckets, prune(), rateLimit(), resetRateLimits(), Window, lookupOrderAction(), LookupOrderResult, ensureTrackingToken() (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.24
Nodes (12): ContactCategory, contactCategoryLabel(), ContactInput, contactSchema, parseContact(), ParsedContact, sanitizeLine(), sanitizeText() (+4 more)

### Community 39 - "Community 39"
Cohesion: 0.23
Nodes (7): submitContactAction(), metadata, CONTACT_CATEGORIES, CONTACT_CATEGORY_LABELS, ContactResult, getClientIp(), ContactForm()

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (8): getPayPalClient(), isPaypalConfigured(), isPaypalWebhookConfigured(), paypalBaseUrl(), POST(), isTerminal(), message(), processPaypalWebhook()

### Community 43 - "Community 43"
Cohesion: 0.40
Nodes (3): CheckoutError, CheckoutErrorCode, messages

## Knowledge Gaps
- **242 isolated node(s):** `CapturedEmail`, `SeededOrder`, `SeedOptions`, `eslintConfig`, `securityHeaders` (+237 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `log` connect `Community 31` to `Community 0`, `Community 2`, `Community 3`, `Community 34`, `Community 37`, `Community 38`, `Community 36`, `Community 8`, `Community 42`, `Community 22`, `Community 23`, `Community 25`, `Community 26`, `Community 29`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `formatMoney()` connect `Community 1` to `Community 33`, `Community 38`, `Community 8`, `Community 9`, `Community 24`, `Community 30`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `PrintifyClient` connect `Community 2` to `Community 26`, `Community 36`, `Community 29`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `CapturedEmail`, `SeededOrder`, `SeedOptions` to the rest of the system?**
  _242 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1103448275862069 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06259780907668232 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.060718252499074414 - nodes in this community are weakly interconnected._