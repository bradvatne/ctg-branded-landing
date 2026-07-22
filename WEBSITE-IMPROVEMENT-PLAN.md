# Clubtech website improvement plan

**Planning baseline:** 2026-07-16
**Repository:** `/Users/brad/Documents/CTG/ctg-branded-landing`
**Scope:** planning only; no production HTML, CSS, JavaScript, generated content, deployment files, or vault notes changed
**Audit coverage:** 62 sitemap URLs, 3 legacy routes, every shared source family, and representative desktop/mobile renders

## Executive assessment

The site has a strong product-led core and a weak long tail.

The homepage is the right benchmark. `/platform/`, `/sell/`, `/grow/`, and `/delivery/` are close to it: decisive typography, real product interfaces, useful dark/light rhythm, restrained accent color, and clear movement toward a demo. The newer generated solution template also succeeds because it turns Markdown into a product page rather than merely styling an article.

The root landing, comparison, and blog-post families do not meet that standard. Root pages such as `/pricing/`, `/about/`, and `/help/` are mostly long prose inside a shared article shell. Comparisons have useful copy and tables, but visually behave like essays; they show almost no Clubtech product. Blog posts are readable, but 21 articles use one linear body and a repetitive generic close. As a result, the site has 62 indexable routes but far fewer than 62 distinct, intentional journeys.

The highest-value move is not a site-wide visual rewrite. Keep the homepage, hand-built pillars, blog index, demo form, and solution-page design language. Build a small block system around them, assign every approved capability a canonical home, and make generated pages choose blocks by intent. Then repair links, redirects, CTA fallbacks, and unapproved feature labels before expanding the long tail.

### Audit findings at a glance

| Finding | Evidence | Decision |
|---|---|---|
| Sitemap availability | All 62 sitemap URLs returned `200` locally. | Keep route set; improve quality and pathways rather than deleting for route-count reasons. |
| Broken assets | 0 broken image, font, CSS, JavaScript, or video URLs in the sitemap crawl. | Preserve current asset organization. |
| Broken internal destinations | `/platform.html`, `/contact.html`, `/revenue.html`, and `/revenue/` return `404`. | Fix source Markdown and generator normalization in Phase 0. |
| Broken anchor | Homepage links to `/booking/#every-guest-data`; the legacy stub has no such anchor. | Point to `/platform/#guest-lists` or the approved canonical subsection. |
| Legacy routes | `/booking/`, `/operations/`, `/intelligence/` return `200` meta-refresh stubs with `noindex`; they are not HTTP redirects. | Implement server-level permanent redirects; retain tiny HTML fallbacks only for hosts that cannot redirect. |
| Metadata | Every sitemap page has one H1, one main landmark, title, description, canonical, and indexable robots directive. | Keep the baseline; shorten 10 overlong descriptions and validate after regeneration. |
| Basic image/button semantics | No sitemap page had an image without an `alt` attribute, a missing main landmark, a duplicate/missing H1, or an obviously nameless button in static markup. | Preserve these invariants in every new block. |
| Weak contextual linking | Several older blog posts have only 1–4 inbound links; global footer links inflate solution/comparison connectivity without creating a persuasive journey. | Replace global-volume linking with topic and intent pathways. |
| Repetitive anchors | `Book a Demo` appears 284 times; many solution/location/comparison labels repeat on every page through the footer. | Keep a consistent CTA label but add contextual pre-CTA copy; reduce the footer to hubs and highest-value routes. |
| CTA fallback inconsistency | `data-open-demo` usually opens a modal, but many fallbacks are `mailto:` and several Markdown body links target the dead `/contact.html`. | Every commercial CTA must fall back to `/book-a-demo/`; email is only for an explicit “Email us” action. |
| Mobile consent collision | On first visit, the consent banner can obscure hero copy, hero CTAs, or the demo form on a 390px viewport. | Redesign the mobile consent surface in Phase 1. |
| Asset weight | Largest product assets are approximately 0.5–0.7 MB; the interactive demo JS is approximately 65 KB and its CSS approximately 48 KB. | Load demos only on routes that use them; set image dimensions/srcsets and performance budgets. |
| Source drift | `README.md` and old comments still describe a prior canonical/mirror arrangement; `build-blog.mjs` is a 1,646-line generator carrying navigation, templates, page configs, sitemap, and llms output. | Establish a build contract and split data/config from rendering before broad refactoring. |

### Keep, redesign, consolidate, remove

- **Keep:** homepage composition, hand-built product pillars, the solution-page product treatment, blog index ledger, Albert Sans type system, navy/mint/lime/indigo palette, real product screenshots, interactive demos, dedicated demo route, named public proof, and quiet motion with reduced-motion support.
- **Redesign:** root landing template, comparison template, article pathway blocks, pricing, hotel journey, support/help CTAs, mobile consent, and the mega-footer.
- **Consolidate:** repeated full explanations of booking, pricing, attribution, integrations, and guest data into canonical pillars; let solutions/comparisons/blog summarize and link.
- **Remove or hide pending approval:** public navigation/feature treatment for Gift cards, Clubtech Reviews, and “Marketing AI” as a named product capability until each is reconciled with an approved vault source. Do not delete code or assets during planning; gate exposure first.
- **Remove from internal links:** legacy route references, `.html` destinations, `/contact.html`, `/revenue/`, and demo CTAs whose only non-JavaScript fallback is email.

## Homepage gold-standard principles

The homepage should remain the standard, not the universal layout.

1. **Outcome before inventory.** Each section names an operator outcome, then shows the product mechanism. “Know what is booked before the doors open” works because it leads with the job, not the console feature list.
2. **A real product surface per major promise.** The map, floor, dashboard, mobile flow, and demo form make claims tangible. Generated pages should inherit this proof discipline.
3. **One idea per visual beat.** Dark and light bands separate Booking, Revenue, Operations, Guest data, Intelligence, Delivery, Pricing, and Proof. The rhythm is varied without becoming decorative.
4. **Specific, restrained proof.** `$875k`, `7+`, `20+`, named clients, and the cleared FINNS quote appear where they answer doubt. Illustrative dashboard numbers must stay visibly illustrative and never become claimed results.
5. **Product imagery has a narrative role.** A screenshot is not decoration. Captions and nearby copy should tell the reader what to notice, who uses it, and what changes next.
6. **Short routes to action.** A visitor can move from overview to a pillar, then to a demo. Every other family needs the same natural handoff without cloning the homepage.
7. **Mobile is recomposed, not shrunk.** Product frames stack, proof stays legible, and the next action remains close. Consent must stop obscuring this first-screen flow.
8. **Motion is optional.** Reveal animations support rhythm but content remains available with reduced motion, no JavaScript, deep links, and automated capture.
9. **The footer is not the information architecture.** Contextual pathways should do the persuasion; the footer should provide reliable wayfinding.

## Complete page and template inventory

### Source-family inventory

| Family | Routes | Source of truth | Current renderer/styles | Quality verdict | Shared action |
|---|---:|---|---|---|---|
| Homepage | 1 | `index.html` | Hand-built; `css/styles.css` plus product-demo styles/scripts | **Gold standard / real product page** | Keep composition; repair links, consent collision, and canonical pathways. |
| Product pillars | 4 | `platform/index.html`, `sell/index.html`, `grow/index.html`, `delivery/index.html` | Hand-built; shared global CSS plus page-specific product demo CSS/JS | **Strong / real product pages** | Preserve; deepen canonical sections and remove unapproved labels. |
| Root landings | 7 | `content/landing/*.md` | `renderRootPage()` in `scripts/build-blog.mjs`; `css/blog.css` plus optional demo CSS | **Weak-to-mixed / undifferentiated article template** | Replace one-size CTA/body with intent-aware blocks. |
| Solutions hub | 1 | Generator config | `renderSolutionsIndex()`; `css/solutions.css` | **Strong hub** | Keep; add clearer canonical links and hotel/use-case distinctions. |
| Solution pages | 15 | `content/pages/*.md` with `section: solutions` plus `SOLUTION_CONFIG` | `renderSolutionPage()`; `css/solutions.css` | **Strong template, uneven source depth** | Keep renderer direction; normalize modules, proof, and links. |
| Comparisons hub | 1 | Generator config | `renderSectionIndex('compare')`; `css/blog.css` | **Useful but visually thin** | Add comparison decision framing and priority journeys. |
| Comparison pages | 10 | `content/pages/*.md` with `section: compare` | Generic `renderLandingPage()`; `css/blog.css` | **Editorial, not product-led** | Introduce comparison-specific block family and verification metadata. |
| Blog index | 1 | `content/blog/*.md` | `renderListing()`; `css/blog.css`, `js/blog.js` | **Strong editorial directory** | Keep; add topic hubs and product-path labels. |
| Blog posts | 21 | `content/blog/*.md` | `renderPost()`; `css/blog.css` | **Readable editorial pages, repetitive pathway** | Add article block slots, topic-related content, and voice cleanup. |
| Conversion | 1 | `book-a-demo/index.html` plus `js/booking.js` | Hand-built inline two-step lead/scheduler flow | **Strong conversion page** | Keep; reduce consent interference and add proof/expectation support. |
| Legacy | 3, outside sitemap | `booking/index.html`, `operations/index.html`, `intelligence/index.html`, `.htaccess` | Meta refresh + canonical + `noindex` | **Not real redirects** | Replace with 301/308 server redirects. |

### Shared template concerns

- **Root landing template:** the same demo-first hero and “Stop reading about it. See it live.” close are wrong for About, Careers, Help, and Support. CTA type must be frontmatter/config-driven (`demo`, `support`, `careers`, `learn`, or none).
- **Solution template:** visual quality is good. Short source pages (`resorts`, `restaurants`) expose that modules are optional and can leave the page noticeably thinner than peers. Enforce minimum narrative coverage by intent, not by word count.
- **Comparison template:** it renders every competitor page like a blog post. The table is the only task-specific block; product proof, decision criteria, switching path, and relevant solution links are missing.
- **Blog-post template:** the related algorithm always selects the first few newest posts rather than topic-adjacent content. It creates repeated destinations and leaves older articles weakly connected.
- **Shared chrome:** generated pages carry approximately 170–180 links because every solution and comparison appears in the footer. This is navigable but noisy and makes every route feel structurally identical.
- **Mobile/accessibility:** static semantics are sound. Risks are the oversized consent overlay, very long mobile footer, dense comparison tables/copy, small metadata text, and interactive product demos that require keyboard/focus testing beyond static markup.

## Page-by-page improvement matrix

Priority uses `P0` foundation, `P1` highest conversion/product value, `P2` supporting commercial intent, and `P3` long-tail cleanup. Effort uses `S` (≤1 focused day), `M` (2–4 days), `L` (5+ days including content/QA).

### Homepage, pillars, hubs, root landings, conversion, and legacy

| Route | Purpose / primary persona | Source | Current quality | Recommendation and key gaps | P / effort |
|---|---|---|---|---|---|
| `/` | Platform overview; Owner, GM, Marketing initiator | `index.html` | Gold-standard product page | **Keep.** Repair retired booking/operations/intelligence links; expose exact cleared pricing via the pricing route; make product subsections link to canonical pillars; shrink mobile consent; ensure all demo fallbacks use `/book-a-demo/`. | P1 / M |
| `/platform/` | Canonical system overview; GM, Hotel IT, Owner | `platform/index.html` | Strong product page | **Keep and deepen.** Make Booking, Operations, Guest lists/VMS, Check-in, Integrations, and AI-agent status explicit canonical subsections with a local section rail. Add every-guest capture and white-label ownership where the product is shown. | P1 / M |
| `/sell/` | Canonical pre-sold revenue; Owner, Revenue Manager | `sell/index.html` | Strong product page | **Keep.** Retain events, packages, dynamic pricing, and four levers. Hide Gift cards until approved; give prepayments/deposits a direct anchor; link every summary solution back here. | P1 / M |
| `/grow/` | Canonical attribution/data/reporting; Marketing Manager, GM | `grow/index.html` | Strong product page | **Keep.** Rename or gate “Marketing AI” pending approval; separate Attribution, Abandoned recovery, Every-guest data, Intelligence, and 20+ reports. Hide Reviews until approved. | P1 / M |
| `/delivery/` | De-risk implementation; GM, Hotel IT, Owner | `delivery/index.html` | Strong product/delivery page | **Keep.** Add implementation inputs/outputs, named support model, integration boundary, and next links to Platform/Hotels. Do not overstate support SLAs. | P1 / M |
| `/solutions/` | Find a route by venue, location, or goal; all buyers | Generator config | Strong visual hub | **Keep.** Clarify venue vs location vs goal labels; promote hotel committee route; every card should state which canonical pillar owns the feature. | P2 / S |
| `/compare/` | High-intent alternative research; Owner, GM, IT | Generator config | Thin editorial hub | **Redesign.** Add “choose by operating model” decision cards, fair-fit doctrine, top three priority comparisons, and links to the relevant solution/pillar before the full index. | P2 / M |
| `/blog/` | Learning and evaluation; Marketing initiator, GM | Generator config + blog frontmatter | Strong editorial index | **Keep.** Add topic filters/hubs for Booking, Revenue, Door, Attribution, Hotels, and Comparisons; show the product pathway each article supports. | P2 / M |
| `/about/` | Company credibility; Owner, partners, candidates | `content/landing/about.md` | Generic root article | **Redesign.** Use company proof, public client wall, operating philosophy, and team/delivery context. Replace generic demo close with “See the platform” plus a secondary demo action. | P2 / M |
| `/ai-bookings/` | Emerging AI-agent discovery; Hotel IT, digital/product leaders | `content/landing/ai-bookings.md` | Honest but generic article | **Keep as emerging thought-leadership.** Add architecture/status diagram and explicit current-vs-planned boundary. `[VERIFY]` production readiness and public MCP surface before adding stronger claims. | P3 / M |
| `/careers/` | Candidate intent | `content/landing/careers.md` | Wrong shared conversion journey | **Redesign lightly.** Use roles/working principles/application CTA; never end on “Book a Demo.” If no roles are open, say so and offer a durable expression-of-interest path. | P3 / S |
| `/for-hotels/` | Hotel executive/committee entry; Hotel F&B Director, Hotel IT | `content/landing/for-hotels.md` | Important content trapped in generic article shell | **Promote to segment pillar.** Show pool/day-pass product, Opera/PMS boundary, resident vs non-resident flow, white-label ownership, IT de-risking, and hotel-specific demo. Distinguish from `/solutions/hotel-pool-booking/` and `/solutions/resorts/`. `[VERIFY]` folio-posting behavior. | P1 / L |
| `/help/` | Self-service answers; existing venue teams and evaluators | `content/landing/help.md` | Generic FAQ article | **Redesign as help hub.** Search/category cards, clear “existing customer” vs “evaluating Clubtech” paths, links to Support, and no demo-first close. | P2 / M |
| `/pricing/` | Commercial evaluation; Owner, finance, GM | `content/landing/pricing.md` | Correct facts, visually underpowered | **Redesign.** Show no monthly fee, 4% paid by guest, and $2,000 one-time setup in a compact commercial block; list inclusions, worked mechanics without invented outcomes, FAQ, and demo CTA. | P1 / M |
| `/support/` | Get help; existing venue teams | `content/landing/support.md` | Product promise in wrong template | **Redesign around support action.** Primary CTA must open the real support route/channel, not a sales demo. Keep console demo only if portal and WhatsApp support are approved. `[VERIFY]` portal, channel, and response promises. | P2 / M |
| `/book-a-demo/` | Convert qualified buyer; all buying personas | `book-a-demo/index.html`, `js/booking.js` | Strong dedicated conversion page | **Keep.** Prevent consent overlap; add concise public proof, what will be prepared, and privacy reassurance; keep form first and scheduler second; validate failure/fallback paths. | P1 / M |
| `/booking/` | Retired booking route | stub + `.htaccess` | `200` meta refresh to `/platform/#booking` | **Remove as content; permanent redirect.** Update all internal links. | P0 / S |
| `/operations/` | Retired operations route | stub + `.htaccess` | `200` meta refresh to `/platform/#operations` | **Remove as content; permanent redirect.** Update all internal links. | P0 / S |
| `/intelligence/` | Retired intelligence route | stub + `.htaccess` | `200` meta refresh to `/grow/#ads` | **Remove as content; permanent redirect** to the final intelligence/reporting anchor, likely `/grow/#guest-data`, not ads. | P0 / S |

### Solution pages

All 15 routes use `content/pages/<slug>.md` plus `SOLUTION_CONFIG` in `scripts/build-blog.mjs`. The template is a keeper; recommendations focus on intent, canonical boundaries, source depth, proof, and pathways.

| Route | Intent / primary persona | Current quality | Recommendation | P / effort |
|---|---|---|---|---|
| `/solutions/beach-clubs/` | Category solution; Owner, GM, Revenue Manager | Strong, fullest solution page | Make this the canonical beach-club segment page. Keep map/floor proof; link feature detail to Platform/Sell/Grow rather than repeating it; add named proof and a beach-club demo path. | P1 / M |
| `/solutions/day-club-booking-system/` | Day-club system; Owner, Revenue Manager | Strong product-led page | Emphasize dayparts, packages, prepayment, and pricing; link details to Sell; differentiate from beach clubs with operating cadence rather than synonyms. | P2 / M |
| `/solutions/event-ticketing-for-clubs/` | Ticketing + door; GM, event operator | Strong | Keep as use-case route; make `/sell/#events` canonical for capability and `/platform/#check-in` canonical for door operation. Add ticket-to-guest-data pathway and QR product proof. | P2 / M |
| `/solutions/guest-list-management-software/` | Guest list/VMS; GM, Marketing Manager | Strong | Keep as use-case route; make `/platform/#guest-lists` canonical. Show list → check-in → every-guest data → audience, with door demo and links to relevant blog cluster. | P1 / M |
| `/solutions/hotel-pool-booking/` | Pool/day-pass use case; Hotel F&B Director, Hotel IT | Strong | Keep as product use case under the `/for-hotels/` segment pillar. Show exact cabana, resident/non-resident boundary, PMS integration, and owned channel. `[VERIFY]` folio posting. | P1 / M |
| `/solutions/nightclub-management-software/` | Whole-night operating system; Owner, GM | Strong | Keep as nightclub segment page. Own the full system story; route table booking, ticketing, lists, and door to their canonical sections. | P2 / M |
| `/solutions/nightclub-table-booking/` | VIP table sales; Owner, Revenue Manager | Strong | Keep as focused transactional use case. Center map-based table choice, packages/minimum spend, prepayment, then link into nightclub management for the service-day story. | P2 / M |
| `/solutions/resorts/` | Multi-outlet resort fit; Hotel F&B Director, Hotel IT | Too short for the solution template | Expand with multi-outlet architecture, PMS/IT boundary, reporting, white-label ownership, and delivery; link to `/for-hotels/` and hotel-pool use case. | P1 / L |
| `/solutions/restaurants/` | Experience-led restaurant fit; Owner, GM | Visually good demo, source body too short | Expand only with approved restaurant fit and proof. Keep the fictional demo clearly labeled. If restaurant-specific capability/proof cannot be approved, consolidate into a narrower “experience-led venues” route or noindex until supported. | P2 / L |
| `/solutions/sunbed-booking-system/` | Exact-furniture booking; Revenue Manager, Hotel F&B Director | Strong | Keep as search/use-case route. Make Platform booking canonical; show map vs grid, live inventory, dynamic pricing, and operations handoff without duplicating pillar copy. | P1 / M |
| `/solutions/beach-club-booking-bali/` | Local commercial intent; Owner, GM | Strongest geo page due FINNS proof | Keep. Anchor local credibility in cleared FINNS proof, approved Midtrans/payment fit, and operational context; remove dead `/contact.html`. | P2 / M |
| `/solutions/beach-club-booking-dubai/` | Seasonal/premium market intent; Owner, Revenue Manager | Good but contains dead `.html` links | Keep. Differentiate by compressed season, multi-currency, and hotel fit; repair `/platform.html` and `/contact.html`; avoid unverified market assertions. | P2 / M |
| `/solutions/beach-club-booking-phuket/` | Seasonal SEA intent; Owner, GM | Good | Keep. Differentiate high/green-season mechanics and multi-currency; link to beach-club canonical and demo. Use “SEA proven” only when backed by approved client/market evidence. | P2 / M |
| `/solutions/beach-club-booking-ibiza/` | Pre-season setup intent; Owner, Revenue Manager | Good | Keep. Make pre-season configuration and package/minimum-spend setup the unique story; do not restate the entire platform. | P3 / M |
| `/solutions/beach-club-booking-mykonos/` | Short-season yield intent; Owner, Revenue Manager | Good | Keep. Center ultra-premium exact-furniture sale and fast in-season reporting; link to Sell/Grow canonical sections. | P3 / M |

### Comparison pages

All 10 routes use `content/pages/<slug>.md` with `section: compare` and the generic article renderer. Every comparison must keep the fair-fit doctrine: state where the alternative fits better, distinguish verified facts from Clubtech interpretation, and record the verification date/source during implementation.

| Route | Intent / primary persona | Current quality | Recommendation | P / effort |
|---|---|---|---|---|
| `/compare/access-collins-alternative/` | Booking/enquiry alternative; GM, Owner | Useful copy/table, little product | Add decision criteria for enquiries vs exact-furniture commerce, a Clubtech map proof band, coexistence path, and contextual demo. `[VERIFY]` competitor facts against current primary sources. | P2 / M |
| `/compare/book-tech-labs-alternative/` | Closest furniture-booking alternative; Owner, Revenue Manager | High-intent but article-like | Prioritize depth comparison: mapping, operations, attribution, delivery, and commercials. Add side-by-side product evidence and an evaluation checklist. `[VERIFY]` current capabilities. | P1 / L |
| `/compare/fourvenues-alternative/` | Nightlife/promoter ecosystem; GM, Marketing Manager | Clear positioning, no product path | Add “night distribution vs daypart/furniture” fit matrix, ticket/door proof, and links to nightclub/event solutions. `[VERIFY]` network and commercial claims. | P2 / M |
| `/compare/hoteligy-alternative/` | Hotel amenity/day-pass alternative; Hotel F&B Director, Hotel IT | Good conceptual frame | Add hotel architecture block, PMS boundary, owned acquisition channel, and links to `/for-hotels/` and hotel-pool solution. `[VERIFY]` current Hoteligy positioning. | P2 / M |
| `/compare/megatix-alternative/` | Ticketing alternative; Owner, event operator | Strong intent, article-only | Add ticket vs furniture decision matrix, QR/door product proof, and an event-specific demo. `[VERIFY]` current ticketing/commercial details. | P2 / M |
| `/compare/resortpass-alternative/` | Marketplace vs direct channel; Hotel F&B Director, Marketing Manager | High-value owned-channel story | Prioritize. Add direct-vs-marketplace economics without invented numbers, guest-data ownership flow, coexistence scenario, and hotel demo. `[VERIFY]` current marketplace terms. | P1 / L |
| `/compare/servme-alternative/` | Restaurant/floor CRM alternative; GM, Owner | Fair, dense prose | Add floor-management vs pre-selling decision matrix, restaurant/experience fit boundary, and product screenshots. `[VERIFY]` current integrations/pricing posture. | P2 / M |
| `/compare/sevenrooms-alternative/` | Enterprise CRM/reservations alternative; Owner, GM, Marketing Manager | Best-known intent, very long article | Prioritize. Keep fair summary; convert the long text into fit cards, matrix, furniture workflow, coexistence/switching path, and named proof. Link to the SevenRooms pricing article and demo. | P1 / L |
| `/compare/tablelist-alternative/` | Nightclub table/list alternative; Owner, GM | Shorter but under-visualized | Add table → package → floor → door sequence, commercial comparison, and nightclub solution pathway. `[VERIFY]` current product name/capabilities. | P2 / M |
| `/compare/urvenue-alternative/` | Resort/venue-commerce alternative; Hotel F&B Director, Hotel IT | Detailed but prose-heavy | Prioritize for similar-fit evaluation. Add product-depth matrix, implementation/switching block, property/independent fit, and hotel/demo path. `[VERIFY]` current capability claims. | P1 / L |

### Blog and resource pages

All 21 posts use `content/blog/<slug>.md`. Keep the article body as the editorial source of truth, but give the renderer optional block slots for one product proof band, one contextual conversion block, and a topic-based related pathway. Do not turn educational articles into disguised product pages.

| Route | Intent / primary persona | Current quality | Recommendation | P / effort |
|---|---|---|---|---|
| `/blog/sevenrooms-pricing-what-venues-pay/` | Pricing research; Owner, GM | Strong high-intent article | Link bidirectionally with SevenRooms comparison; add “how to read any quote” checklist and one Clubtech commercial card. Keep competitor pricing caveated and current. | P1 / M |
| `/blog/online-guest-list-vs-rsvp-tools/` | Tool-choice education; GM, Marketing Manager | Clear answer-first article | Link to guest-list solution, how-to article, and Platform guest-list canonical; add a simple “form vs venue system” decision block. | P2 / S |
| `/blog/how-to-make-a-guest-list-online/` | How-to intent; GM, door lead | Useful entry article | Keep the five-minute answer; add escalation signals, guest-list product proof, and correct demo fallback. | P2 / S |
| `/blog/guest-list-management-for-venues/` | Category guide; GM, Marketing Manager | Strong cluster pillar | Make this the guest-list editorial pillar; link to all four related door/list articles, the solution, and Platform canonical. Shorten its overlong meta description. | P1 / M |
| `/blog/guest-list-counter/` | Narrow operational query; door lead, GM | Thin but distinct | Keep as supporting article; add count → identity → owned audience pathway and contextual link to the cluster pillar. | P3 / S |
| `/blog/door-check-in-qr-scanning-for-venues/` | Door/QR research; GM, event operator | Strong product-adjacent article | Add QR/check-in product band and link to event ticketing plus Platform check-in. Preserve exact approved commercial terms. | P2 / M |
| `/blog/club-promoter-software/` | Promoter/door tooling; GM, Marketing Manager | Fair and useful | Link to nightclub management, guest-list cluster, and Fourvenues/Tablelist comparisons; add “promoter tool vs venue system” fit block. | P3 / M |
| `/blog/the-hidden-revenue-leak-in-your-beach-club-booking-flow/` | No-show/prepayment intent; Owner, GM | Strong narrative, broken `.html` links | Repair links; add booking-flow product proof; route to Sell revenue and beach-club solution. | P1 / M |
| `/blog/big-match-playbook-major-events-revenue/` | Event revenue planning; Owner, GM, Revenue Manager | Useful seasonal playbook | Replace dead contact link; add step-based event operating flow and event-ticketing pathway. | P2 / M |
| `/blog/meta-conversions-api-for-venue-bookings/` | Technical attribution research; Marketing Manager | Strong differentiated content, broken `/revenue.html` | Repair link to `/grow/#ads`; add event-flow diagram and explicit boundary between approved capability and implementation detail. | P1 / M |
| `/blog/ga4-for-venue-bookings/` | Measurement setup; Marketing Manager | Strong | Repair contact link; add booking-value event model and cross-link Meta article, Grow, and marketing strategy. | P1 / M |
| `/blog/finns-beach-club-case-study/` | Proof/evaluation; Owner, GM | High-value named proof | Treat as the primary customer story. Add cleared quote treatment, before/mechanism/after structure without inventing metrics, and links to beach-club solution/demo. Repair `.html` links. | P1 / L |
| `/blog/dynamic-pricing-for-beach-clubs/` | Yield/pricing education; Revenue Manager, Owner | Strong | Add pricing-calendar/rules product band and direct pathway to `/sell/#dynamic-pricing`; repair contact link. | P1 / M |
| `/blog/beach-club-revenue-playbook/` | Revenue category guide; Owner, Revenue Manager | Strong cluster pillar | Make this the revenue editorial pillar; link four levers to Sell anchors and supporting posts. Repair contact link. | P1 / M |
| `/blog/beach-club-marketing-strategy/` | Marketing strategy; Marketing Manager, GM | Comprehensive but long | Create a scannable campaign loop, link Meta/GA4/first-party articles, and route to Grow. Repair contact link; keep claims source-backed. | P2 / L |
| `/blog/beach-club-booking-system-complete-guide/` | Category/vendor evaluation; GM, Owner | Strong buyer guide | Make this the booking editorial pillar; repair `/platform.html` and `/contact.html`; add evaluation checklist and map/floor proof. | P1 / L |
| `/blog/that-last-click-before-checkout-could-be-worth-thousands/` | Upsell education; Owner, Revenue Manager | Legacy voice, broad claims | Rewrite to current voice with specific booking mechanics; link to Sell packages and revenue playbook. Do not imply unverified revenue figures. | P3 / M |
| `/blog/the-ux-behind-a-sold-out-saturday/` | Booking UX; GM, Marketing Manager | Legacy short-form article | Refresh with current map/mobile product proof and connect to booking guide/platform. Preserve useful design thesis; remove generic SaaS phrasing. | P3 / M |
| `/blog/your-guests-want-to-spend-more-youre-just-not-letting-them/` | Upsell strategy; Owner, Revenue Manager | Legacy, repetitive with other upsell posts | Consolidate unique ideas into a stronger package/add-on article; redirect only if the retained article fully serves intent. Otherwise rewrite and cross-link. | P3 / M |
| `/blog/maximize-beach-club-revenue-the-power-of-pre-booked-upsells/` | Upsell query; Owner, Revenue Manager | Violates current voice (“Unlock Profitability”, generic “The Takeaway”) | Rewrite or consolidate with the stronger upsell article. Remove banned AI-isms; add specific packages/add-ons mechanics and Sell pathway. | P2 / M |
| `/blog/why-first-party-data-is-the-future-of-beach-club-marketing/` | First-party data education; Marketing Manager | Useful topic, generic legacy structure | Rewrite “Problem/Solution/Goldmine/Takeaway” framing into operator-specific mechanics; link every-guest capture, Grow, and guest-list cluster. | P2 / M |

## Approved feature-coverage matrix

“Approved” below means the capability appears in `Messaging House.md`, `Clubtech Booking Platform.md`, or the cleared client deck breakdown. A source conflict or code-only feature remains `[VERIFY]` even if a page already markets it.

| Capability | Approved claim source | Canonical home | Existing support | Gap / action | Product asset or demo | Required links | Verification status |
|---|---|---|---|---|---|---|---|
| 3D birds-eye reservations and exact furniture | Messaging House pillar 4; Booking Platform; deck slides 4, 6, 7 | `/platform/#booking` | Homepage, beach-club/sunbed/day-club/hotel/nightclub solutions, booking guide | Canonical section needs strongest full explanation: map psychology, exact inventory, guest flow, white-label context. | `booking-map.webp`; interactive `data-demo="map"` | Inbound from all furniture solutions/comparisons/articles; outbound to Sell packages and Platform operations. | Approved |
| 360° walkthroughs | Messaging House; Booking Platform | `/platform/#booking` | Homepage copy, booking/no-show articles | No dedicated visual proof is obvious. Add approved media or keep as concise copy. | `[ASSET GAP]` approved 360 walkthrough capture | Inbound from booking/solution pages; outbound to demo. | Approved claim; asset needed |
| Tiered packages and add-ons | Messaging House; Booking Platform; deck slides 4–6 | `/sell/#packages` | Homepage, Sell, day/night/sunbed solutions, upsell posts | Consolidate package ladder, stackable examples, and checkout handoff in Sell. | interactive booking demo; `events-checkout.webp` where relevant | Solutions/articles → Sell; Sell → booking canonical/demo. | Approved |
| Dynamic pricing and Book Online & Save | Messaging House; Booking Platform | `/sell/#dynamic-pricing` | Homepage, Sell, geo/day/sunbed pages, dynamic-pricing article | Strong demo exists; add canonical rules/guardrails and link all summary mentions. | `pricing-calendar.webp`, `pricing-rules.webp`, pricing demo | Inbound from revenue manager routes; outbound to revenue playbook/demo. | Approved |
| Prepayments, deposits, minimum spends | Messaging House pillar 1; deck slides 5, 18 | `/sell/#revenue` with a direct `#prepayments` subsection | Homepage, Sell, beach/day/night/hotel routes, no-show/revenue articles | The feature is present but lacks its own stable anchor. Explain payment commitment without inventing no-show uplift. | booking/order-review demo; `[ASSET GAP]` approved payment/deposit screen | Inbound from solution/comparison/blog; outbound to pricing/demo. | Approved |
| Abandoned-booking recovery | Messaging House pillars 1–2; Booking Platform; deck slide 13 | `/grow/#ads` with `#abandoned-recovery` | Homepage, Grow, marketing/Meta/revenue articles | Give the sequence a visual event/recovery flow and distinguish platform event from campaign execution. | `intel-attribution.webp`; `[ASSET GAP]` approved recovery creative/email | Booking/Sell/blog → Grow; Grow → demo and attribution articles. | Approved |
| Every-guest data capture | Messaging House pillar 3; Booking Platform; deck slide 9 | `/platform/#guest-lists` with `#every-guest-data` | Homepage, guest-list solution/articles, Grow | Homepage currently points to dead legacy anchor. Explain booker invitation → guest details → owned audience; link to Grow for use of data. | mobile guest flow; `doorlist-list.webp`; `[ASSET GAP]` invitation/detail capture | Inbound from guest-list/event/marketing pages; outbound to Grow. | Approved |
| Guest lists / VMS | Messaging House pillar 4; deck slides 4, 9–10 | `/platform/#guest-lists` | Guest-list solution and cluster, nightclub/event pages | Clarify reservations, promoter lists, priority entry, and VMS boundary; avoid unsupported operational promises. | `doorlist-list.webp`, `doorlist-soldout.webp` | Solutions/blog → Platform; Platform → check-in/demo. | Approved |
| Ticketing and QR check-in | Booking Platform; deck slides 4, 6, 8 | `/sell/#events` for sales; `/platform/#check-in` for service-day operation | Event-ticketing solution, door/QR article, nightlife pages | Separate commercial setup from door execution; link the two canonical sections. | `events-tickets.webp`, `events-checkout.webp`, door list assets | Event routes → both canonicals → demo. | Approved |
| Front-of-house floor operations and allocation | Messaging House pillar 4; Booking Platform; deck slides 10–11 | `/platform/#operations` | Homepage, Platform, delivery, beach/night/hotel solutions | Keep strong product proof; add role/task framing and reservation → allocation handoff. | `operator-floor.webp`, `operator-reservations.webp`, operator demo | Booking/Sell/solutions → Operations; Operations → Delivery/demo. | Approved |
| Inventory sync and operator console | Messaging House; deck slides 10–11 | `/platform/#operations` | Homepage, Platform | Present as one operational sequence, not a second product list. | operator assets/demo | Inbound from every inventory solution; outbound to delivery/support. | Approved |
| Ads attribution: Meta, Google, GA4, value-based optimization | Messaging House pillar 2; Booking Platform | `/grow/#ads` | Homepage, Grow, Meta/GA4/marketing articles | Add a canonical event model; keep revenue values and abandoned events exact and source-backed. | `intel-attribution.webp` | Blog/Sell → Grow; Grow → related articles/demo. | Approved |
| Guest intelligence and 20+ reports | Messaging House pillars 3–4; deck slides 14–15 | `/grow/#guest-data` | Homepage, Grow, resort/Mykonos pages | Separate illustrative dashboard values from claimable `20+ reports`; add report categories and buyer questions. | `intel-reports.webp`, intelligence demo | Solutions/Platform → Grow; Grow → demo. | Approved; dashboard values illustrative only |
| White-label ownership | Messaging House pillar 3; Booking Platform | `/platform/#booking` with stable `#white-label` subsection | Homepage, hotel/resort/restaurant/comparisons | Make venue domain/design/data ownership explicit once; supporting pages summarize and link. | approved booking screenshots under venue branding | Marketplace comparisons/hotel/solutions → Platform. | Approved |
| Mobile-first, sub-second, four taps, 82% after 10pm | Messaging House; Booking Platform | `/platform/#booking` | Homepage, Platform, booking/no-show/case-study content | Use one approved mobile proof block and avoid repeating the stat on every page. Performance implementation must substantiate sub-second claim. | interactive mobile flow | Articles/solutions → canonical; canonical → demo. | Approved claim; verify live performance continuously |
| Integrations and low switching cost | Messaging House; Booking Platform; deck slide 12 | `/platform/#integrations` | Platform, Delivery, Hotels, comparisons, llms | Create categories and status labels; reconcile the conflicting lists before naming every connector. Do not imply every listed integration is currently live in every market. | `[ASSET GAP]` approved architecture/integration UI | Hotels/Delivery/comparisons → canonical; canonical → delivery/demo. | **[VERIFY] exact roster/status** |
| Hotel/PMS fit | Messaging House low-switching claim; Booking Platform Opera; deck slide 12; Personas | `/for-hotels/`; technical detail in `/platform/#integrations` | Hotel-pool, resorts, Hoteligy/ResortPass comparisons | Clarify resident/day guest, PMS boundary, security/IT questions, and white-label ownership. | booking/floor assets; `[ASSET GAP]` approved hotel workflow | Solutions/comparisons → For Hotels → Platform/Delivery/demo. | **[VERIFY] folio posting and connector behavior** |
| Delivery, onboarding, training, 90-day hypercare, data advisory | Deck slide 17; Messaging House delivery references | `/delivery/` | Homepage, About, For Hotels | Strong page; add exact inputs/outputs and keep support promises within cleared deck language. | `operator-reservations.webp`; delivery timeline | Every high-intent comparison/hotel page → Delivery/demo. | Approved |
| Support | Deck slide 17 dedicated lead/hypercare; Messaging House support context | `/support/` for action; `/help/` for self-service | Delivery, support landing | Split sales/delivery proof from actual customer-support channels. | `support-console.webp`, `support-thread.webp` | Product/footer → Help/Support; Support → actual channel. | **[VERIFY] portal, WhatsApp support, SLA** |
| Multi-currency and local payments | Booking Platform; Messaging House integrations | `/platform/#integrations` | Dubai/Phuket/Bali/hotel pages | Explain availability by integration/market only after roster reconciliation. | `[ASSET GAP]` approved checkout/payment capture | Geo/hotel pages → integrations/demo. | Approved at high level; **[VERIFY] availability by market** |
| AI-agent bookings / MCP | Booking Platform marketing note | `/ai-bookings/` with status boundary; link from `/platform/#ai-agent` | Platform nav and root landing | Keep “emerging”; document current vs planned capability and do not imply broad agent availability. | `agentbook.css/js`; approved agent demo if current | Platform/resources → AI page → demo/contact appropriate to readiness. | **[VERIFY] public readiness** |
| Gift cards | Not found in loaded approved sources | None until approved | `/sell/#gift-cards`, nav/footer, `giftcard.css/js` | Hide from public IA or mark internally gated until approved source exists. | Code/demo asset only is insufficient | No public inbound until approval. | **[VERIFY]** |
| Clubtech Reviews | Not found in loaded approved sources | None until approved | `/grow/#reviews`, nav/footer, `reviews.css/js` | Hide from public IA or approve claim set and canonical home first. | Code/screenshots only are insufficient | No public inbound until approval. | **[VERIFY]** |
| “Marketing AI” as named capability | Attribution/optimization is approved; AI label is not explicit | Use `/grow/#ads` unless approved separately | `/grow/#marketing-ai`, nav/footer | Rename to outcome-led approved language or obtain explicit approval for AI behavior. | Attribution asset | All inbound should use approved anchor language. | **[VERIFY]** |

## Internal-link and conversion-path audit

### Current architecture

```text
Global nav/footer
  ├─ sends almost every page to all major pillars
  ├─ footer sends every page to nearly every solution and comparison
  └─ repeated Book a Demo triggers open the same modal

Contextual content
  ├─ hand-built pillars: generally useful product-to-demo flow
  ├─ solutions: good related-solution cards, but feature links are inconsistent
  ├─ comparisons: “more comparisons” is alphabetical/template-driven
  └─ blog posts: “more entries” is newest-first, not topic-first
```

### Confirmed problems

1. **Four broken destinations:** `/platform.html`, `/contact.html`, `/revenue.html`, `/revenue/`.
2. **One broken anchor:** homepage `/booking/#every-guest-data`.
3. **Three legacy paths are still linked from visible homepage copy:** `/booking/`, `/operations/`, `/intelligence/`. They visually redirect but remain a needless hop and are not server redirects.
4. **Weak blog inbounds:** six older posts have only one inbound link in the local graph; five more have only two. The blog index prevents true orphans, but the site gives those articles no contextual authority.
5. **Dead-end articles:** many bodies end in `mailto:` or dead `/contact.html`, then rely on the generic closing modal trigger. There is no next-best product or solution route near the decision point.
6. **Shallow comparisons:** a reader can compare, then mostly sees more comparisons or the generic demo. There is no route through the relevant product pillar, solution, implementation risk, and demo.
7. **Repetitive shared anchors:** the mega-footer repeats every solution/location/comparison on every page. It creates connectivity without relevance and makes contextual links harder to distinguish.
8. **CTA fallback inconsistency:** JavaScript intercept makes many demo actions work, but the underlying URLs disagree (`mailto:`, `/book-a-demo/`, `/contact.html`). Progressive enhancement is unreliable.
9. **Homepage canonical drift:** several sections still link to retired route names even though the navigation was rebuilt around Platform/Sell/Grow.
10. **Footer scale on mobile:** the full taxonomy creates an unusually long post-conversion tail and small, dense link targets.

### Target journey rules

- Every **feature summary** links to one canonical pillar anchor.
- Every **solution** links to 2–4 relevant canonical capabilities, one proof/resource, and `/book-a-demo/`.
- Every **comparison** links to the relevant solution, the product capability being compared, Delivery when switching risk matters, and a demo configured to that evaluation.
- Every **article** links to its topic pillar article, one canonical product section, one relevant solution/comparison, and a contextual demo only when the reader has reached evaluation intent.
- Every **Book a Demo** action has `/book-a-demo/` as its real `href`; JavaScript may enhance it into the modal.
- **Email** remains a separately labeled contact option, never the silent fallback for a demo CTA.
- The **footer** links to hubs and priority destinations; topic-specific related blocks carry long-tail discovery.

### Proposed topic clusters

| Cluster | Editorial pillar | Supporting content | Product/solution destination | Conversion |
|---|---|---|---|---|
| Booking system | Complete guide | No-shows, sold-out UX, FINNS case study | `/platform/#booking`, beach-club/sunbed solutions | Venue-map demo |
| Revenue | Beach-club revenue playbook | Dynamic pricing, big match, three upsell articles | `/sell/` anchors | Revenue-configured demo |
| Door and guest lists | Guest-list management guide | RSVP tools, how-to, counter, QR, promoter software | `/platform/#guest-lists`, guest-list/event/nightclub solutions | Door/floor demo |
| Attribution | Beach-club marketing strategy | Meta CAPI, GA4, first-party data | `/grow/#ads`, `/grow/#guest-data` | Marketing-loop demo |
| Hotels | For Hotels | Hotel-pool/resort solutions, Hoteligy/ResortPass comparisons | `/for-hotels/`, integrations, delivery | Hotel-specific demo |
| Alternatives | Compare hub | 10 comparisons + SevenRooms pricing | relevant pillar/solution per competitor | Evaluation-specific demo |

## Proposed content-block layout library

Use seven families. Pages choose the smallest set that explains their intent; none is mandatory everywhere.

### 1. Product-stage hero

- **Purpose:** make one commercial promise tangible above the fold.
- **Low-fidelity structure:** `[kicker + H1 + 1 short paragraph + primary/secondary CTA] [large live product surface] [3 proof chips]`.
- **Content limits:** H1 ≤ 12 words; paragraph ≤ 45 words; 3 proof chips; 2 CTAs maximum.
- **Assets:** interactive map/floor/demo, or one high-resolution product screenshot with a small venue-context image. Never a stock image alone.
- **CTA behavior:** commercial pages use `/book-a-demo/`; editorial pages use the relevant pillar first.
- **Desktop/mobile:** split stage at desktop; mobile places copy, CTA, then product frame. The product remains large enough to read and is not covered by consent.
- **Ideal routes:** Platform, Sell, Grow, For Hotels, priority solutions, demo.
- **Examples:** `/platform/`, `/sell/`, `/solutions/beach-clubs/`, `/for-hotels/`.

### 2. Sticky narrative workflow

- **Purpose:** explain a sequence whose state changes from guest action to venue operation.
- **Low-fidelity structure:** `[sticky product frame] [01–04 steps: trigger → interface → operator result → data handoff]`.
- **Content limits:** 3–5 steps; each step ≤ 55 words; one screen/state per step.
- **Assets:** booking flow, event ticket → QR door, guest invitation → data, reservation → floor allocation, abandoned event → return.
- **CTA behavior:** one quiet “See this flow in the demo” after the final step.
- **Desktop/mobile:** sticky left/right frame on desktop; stacked numbered cards with cropped screen state on mobile. No horizontal scroll required.
- **Ideal routes:** capability sections, solution pages, case study, technical articles.
- **Examples:** `/solutions/event-ticketing-for-clubs/`, `/platform/#operations`, Meta CAPI article, FINNS case study.

### 3. Bento capability grid

- **Purpose:** summarize related capabilities without a wall of equal cards or alternating two-columns.
- **Low-fidelity structure:** one dominant 2× card plus 3–5 smaller cards; each card answers “what changes?” and links to canonical detail.
- **Content limits:** 4–6 cards; title ≤ 5 words; body ≤ 28 words; only the dominant card may carry a screenshot.
- **Assets:** product crop, metric/proof chip, simple approved icon; no decorative feature collage.
- **CTA behavior:** per-card text link to canonical anchor; no repeated demo buttons.
- **Desktop/mobile:** asymmetric grid on desktop; dominant card first, compact stack on mobile.
- **Ideal routes:** homepage summaries, Platform, Sell, Grow, solution hubs, About.
- **Examples:** revenue levers on `/sell/`, hotel requirements on `/for-hotels/`, capability summary on `/solutions/nightclub-management-software/`.

### 4. Full-width product proof band

- **Purpose:** interrupt prose with one indisputable product or customer proof moment.
- **Low-fidelity structure:** `[short claim + annotation] [wide screenshot/demo] [caption: what to notice / who uses it]` or `[cleared quote] [mechanism] [route onward]`.
- **Content limits:** one claim, one surface, one caption; testimonial excerpt must stay within cleared quote.
- **Assets:** approved product screenshots, interactive demos, cleared FINNS quote, public client wall. Dashboard sample values labeled illustrative.
- **CTA behavior:** optional text link; demo button only on high-intent commercial pages.
- **Desktop/mobile:** full-width framed surface on desktop; vertically cropped but legible detail on mobile with caption before/after.
- **Ideal routes:** solutions, comparisons, articles, pricing, About.
- **Examples:** SevenRooms comparison map proof, dynamic pricing article, pricing commercial card, FINNS case study.

### 5. Step-based operating flow

- **Purpose:** show implementation or day-of operating order where a product screenshot is secondary.
- **Low-fidelity structure:** `[01] [02] [03] [04/05]` connected by a thin rule, each with input, team, and output.
- **Content limits:** 4–5 steps; ≤ 35 words each; one owner/team label per step.
- **Assets:** small screen crops or status chips only where they clarify state.
- **CTA behavior:** after the flow, link to Delivery or the relevant product stage.
- **Desktop/mobile:** horizontal sequence on desktop; vertical timeline with persistent numbering on mobile.
- **Ideal routes:** Delivery, event nights, guest lists, onboarding sections, implementation comparisons.
- **Examples:** `/delivery/`, event ticketing, UrVenue switching path.

### 6. Fair-fit comparison system

- **Purpose:** help a buyer decide, not merely declare Clubtech the winner.
- **Low-fidelity structure:** `[best fit for each] [6–8 row matrix] [where each wins] [coexist/switch path] [Clubtech product proof]`.
- **Content limits:** 6–8 decision criteria; cells ≤ 24 words; no unverifiable superlatives; verification date/source stored in frontmatter.
- **Assets:** one relevant Clubtech product surface; competitor logos/screens only with rights and current-source checks.
- **CTA behavior:** “See Clubtech on your [floor/deck/door]” → `/book-a-demo/`; secondary link to relevant solution.
- **Desktop/mobile:** table with pinned criterion column or semantic stacked rows; never force unreadable zooming.
- **Ideal routes:** all `/compare/*`; selected vendor-evaluation articles.
- **Examples:** SevenRooms, ResortPass, Book Tech Labs, UrVenue.

### 7. Related-pathway rail

- **Purpose:** replace generic “more entries” and mega-footer dependency with a persuasive next step.
- **Low-fidelity structure:** `[Learn] [See product] [See fit/proof] [Book demo]`, 3 cards plus one CTA.
- **Content limits:** 3 related destinations chosen by topic/intent; card copy ≤ 24 words.
- **Assets:** one thumbnail at most per card; use product crops for product links and venue/editorial images for articles.
- **CTA behavior:** demo appears only as the final route and always has `/book-a-demo/` fallback.
- **Desktop/mobile:** three cards in a row; swipe-free vertical stack on mobile.
- **Ideal routes:** every generated page family.
- **Examples:** guest-list cluster, hotel cluster, comparison-to-solution path, blog-to-pillar path.

## Recommended site architecture

### Canonical product homes

| Canonical route | Owns the full explanation | Supporting routes summarize and link |
|---|---|---|
| `/platform/#booking` | 3D map, exact furniture, 360 walkthroughs, mobile checkout, white-label | Beach/day/sunbed/hotel/nightclub solutions; booking/no-show/UX articles; relevant comparisons |
| `/platform/#operations` | Floor plan, allocation, inventory sync, operator console | Nightclub, beach club, hotel/resort solutions; Delivery; case study |
| `/platform/#guest-lists` | VMS, every-guest capture, priority entry | Guest-list/event/nightclub solutions and cluster |
| `/platform/#check-in` | QR and door operation | Sell events, event solution, QR article |
| `/platform/#integrations` | Approved connector categories, low-switching architecture | For Hotels, Delivery, comparisons, geo pages |
| `/sell/#events` | Ticket setup and selling | Event solution, nightlife pages, event article |
| `/sell/#packages` | Packages, add-ons, pre-arrival spend | Day/night/sunbed solutions; upsell content |
| `/sell/#dynamic-pricing` | Pricing rules and Book Online & Save | Geo/day/sunbed routes; dynamic pricing article |
| `/sell/#revenue` | Four revenue levers, with direct prepayment and recovery links | Homepage, revenue playbook, solutions |
| `/grow/#ads` | Booking-value attribution and abandoned recovery | Meta/GA4/marketing articles, comparisons |
| `/grow/#guest-data` | Owned data, intelligence, reporting, 20+ reports | Guest-list cluster, hotel/resort routes, case study |
| `/delivery/` | Rollout, training, go-live, hypercare, advisory | All high-intent solutions/comparisons and About |
| `/for-hotels/` | Hotel committee story and property-level fit | Hotel-pool/resort solutions, hotel comparisons |
| `/pricing/` | Public commercials and setup inclusions | Homepage, comparisons, solution proof sections |
| `/support/` and `/help/` | Support action and self-service help respectively | Product/footer; not sales-demo clones |

### Global navigation

- **Platform:** Booking; Operations & floor; Guest lists & VMS; Door & check-in; Integrations; AI-agent bookings (only while clearly marked Emerging).
- **Sell:** Events & ticketing; Packages & add-ons; Dynamic pricing; Prepayments & revenue. Hide Gift cards pending approval.
- **Grow:** Ads & attribution; Abandoned recovery; Guest data; Intelligence & reports. Rename/hide Marketing AI and Reviews pending approval.
- **Solutions:** By venue (Hotels & resorts, Beach clubs, Day clubs, Nightclubs, Restaurants only if approved); by goal (Sunbeds, Events, Guest lists); by location (Bali, Dubai, Phuket, Ibiza, Mykonos).
- **Resources:** Blog/topic hubs; FINNS case study; Compare; Help.
- **Pricing** and **Company** remain top-level; Company holds About, Careers, Delivery, Support, Contact.
- The global CTA remains **Book a Demo** with a real `/book-a-demo/` href.

### Footer

Reduce the footer to canonical pillars, solution hubs, the five highest-value segment/use-case routes, Compare hub plus 3 priority comparisons, key resources, and company/support. Do not list all 25 solution/comparison children on every page. Keep the oversized wordmark and brand finish; convert long mobile columns into accessible disclosure groups only if the links remain crawlable and keyboard-usable.

### Duplication rules

- Canonical pages explain **how the capability works**.
- Solutions explain **why it matters for this venue/market/goal**, then link to the canonical mechanism.
- Comparisons explain **which operating model fits**, then show one product proof and link to canonical detail.
- Blog posts answer **the query completely**, then offer a relevant product path without repeating sales-page copy.
- Hubs summarize and route; they do not restate every child.
- Pricing, proof, and cleared stats come from one structured source/config so generated pages cannot drift.

## Prioritized phased backlog

Impact uses `High`, `Medium`, `Low`; effort uses `S`, `M`, `L`. Dependencies name earlier backlog items where required.

### Phase 0 — source, template, and information-architecture foundations

| ID | Recommendation | Priority / impact / effort | Dependencies | Affected source | Verifiable acceptance criteria |
|---|---|---|---|---|---|
| 0.1 | Freeze an audit baseline and document generated-vs-source ownership, including current concurrent worktree changes. | P0 / High / S | None | `README.md`, build documentation | A fresh session can identify every editable source and generated output without touching HTML by mistake; README canonical comments match production reality. |
| 0.2 | Create a structured approved-capability/config manifest with claim source, canonical anchor, approval state, and asset. | P0 / High / M | 0.1 | New config/data module used by `build-blog.mjs` | Gift cards, Reviews, Marketing AI, AI readiness, integration roster, and support details cannot render as approved unless explicitly marked. |
| 0.3 | Split navigation/footer/page configuration from the 1,646-line renderer; keep zero-runtime-dependency build if desired. | P0 / High / L | 0.1–0.2 | `scripts/build-blog.mjs` plus new build modules | Build output is byte-stable before template changes; nav/footer/config changes have one source; `npm run build:blog` succeeds. |
| 0.4 | Add block/frontmatter schema for generated families: `layout`, `modules`, `ctaType`, `related`, `canonicalFeature`, `proof`, `verificationDate`. | P0 / High / L | 0.2–0.3 | `content/landing/*.md`, `content/pages/*.md`, build modules | Invalid/missing required fields fail the build with file-specific errors; short solutions cannot silently omit required intent modules. |
| 0.5 | Repair broken links and normalize old destinations in source and renderer. | P0 / High / S | None | Listed Markdown, `index.html`, normalization helper | Crawl reports 0 broken internal destinations and 0 missing anchors; no `.html`, `/contact.html`, `/revenue/`, or visible legacy links remain. |
| 0.6 | Implement real permanent redirects for Booking, Operations, and Intelligence. | P0 / High / S | Final canonical anchors from 0.2 | `.htaccess`, legacy stubs | Server returns 301/308 to final anchor routes; stubs remain only as non-server fallback; legacy routes stay out of sitemap/nav. |
| 0.7 | Standardize conversion links: `/book-a-demo/` is the fallback for every demo trigger; email is explicitly labeled. | P0 / High / M | 0.3–0.4 | build templates, hand-built HTML, Markdown | With JS disabled, every Book a Demo action reaches the inline demo page; no sales CTA falls to mail client or 404. |
| 0.8 | Replace all-child mega-footer with hub/priority footer and implement topic/intent related mapping. | P0 / High / L | 0.3–0.4 | footer renderer, related algorithms/config | Footer link count drops materially; every generated page has exactly 3 intentional related destinations; older blog posts receive contextual inbound links. |
| 0.9 | Reconcile approved integration roster, code-only features, support channels, AI readiness, and hotel folio behavior with vault/owner. | P0 / High / M | 0.2 | Vault review only during implementation; manifest | Every `[VERIFY]` item is approved with a source or removed/hidden; no code/asset filename is used as approval evidence. |
| 0.10 | Establish automated crawl/report command for sitemap, internal links, anchors, assets, metadata, canonicals, redirects, and duplicate destinations. | P0 / High / M | 0.3 | build tooling | One command outputs route-level failures and exits nonzero; it covers every sitemap route plus declared legacy redirects. |

### Phase 1 — highest-value conversion and product pages

| ID | Recommendation | Priority / impact / effort | Dependencies | Affected source | Verifiable acceptance criteria |
|---|---|---|---|---|---|
| 1.1 | Preserve homepage composition; repair pathways, pricing summary, canonical anchors, and demo fallbacks. | P1 / High / M | 0.2, 0.5, 0.7 | `index.html` | Every capability summary reaches its canonical home; no legacy link hop; public pricing summary matches Pricing/vault. |
| 1.2 | Deepen Platform as canonical Booking/Operations/Guest lists/Check-in/Integrations page with stable section rail. | P1 / High / L | 0.2, 0.9 | `platform/index.html`, relevant CSS/JS | All approved platform capabilities have one stable anchor, product proof, inbound/outbound links, and demo route. |
| 1.3 | Refine Sell; add direct prepayment anchor and gate Gift cards. | P1 / High / M | 0.2, 0.9 | `sell/index.html`, nav/footer config | Events, Packages, Dynamic pricing, Prepayments, and Revenue each have approved copy/anchor; Gift cards absent unless approved. |
| 1.4 | Refine Grow; separate attribution, recovery, owned data, intelligence, and reports; gate AI/Reviews labels. | P1 / High / M | 0.2, 0.9 | `grow/index.html`, nav/footer config | Every section maps to approved claims; sample dashboard figures are marked illustrative; unapproved labels are absent. |
| 1.5 | Redesign Pricing with public commercial block and exact setup inclusions. | P1 / High / M | 0.4, 0.7 | `content/landing/pricing.md`, root template/block CSS | 4%, $2,000, payer, no-monthly-fee, and inclusions match approved source; CTA works without JS; mobile has no overflow. |
| 1.6 | Promote For Hotels into a segment pillar and define its relationship to hotel-pool/resort pages. | P1 / High / L | 0.4, 0.9 | `content/landing/for-hotels.md`, templates/styles | Both Hotel F&B and IT concerns are addressed; all technical specifics are approved; contextual links form the hotel cluster. |
| 1.7 | Keep Delivery, add implementation inputs/outputs and approved support boundary. | P1 / Medium / M | 0.9 | `delivery/index.html` | Five stages remain clear; no unsupported SLA/channel claim; links connect Platform, Hotels, Support, Demo. |
| 1.8 | Improve Book a Demo proof, failure states, fallback, and mobile composition. | P1 / High / M | 0.7 | `book-a-demo/index.html`, `js/booking.js`, `css/booking.css` | Form validation is keyboard/screen-reader usable; scheduler failure exposes direct link; JS-off page remains usable; proof is approved. |
| 1.9 | Redesign mobile consent so it does not cover primary hero CTA/form. | P1 / High / M | None | `css/consent.css`, `js/consent.js` | At 390×844, first-screen H1, primary CTA, and first form field remain usable; all consent choices are reachable and accessible. |

### Phase 2 — solutions and supporting landing pages

| ID | Recommendation | Priority / impact / effort | Dependencies | Affected source | Verifiable acceptance criteria |
|---|---|---|---|---|---|
| 2.1 | Normalize 15 solution sources to venue/location/goal module contracts while preserving the strong visual template. | P2 / High / L | 0.4, Phase 1 canonicals | `content/pages/*` solutions, solution renderer/CSS | Every solution has intent-specific workflow, capability links, outcome, fit, proof/verification, related pathway, and demo. |
| 2.2 | Prioritize beach clubs, sunbeds, guest lists, hotel pool, and resorts. | P1 / High / L | 2.1 | Five source files/config assets | Each page demonstrates its distinct product surface and links to correct canonical feature; hotel routes do not duplicate one another. |
| 2.3 | Clarify nightclub management vs table booking; event selling vs check-in. | P2 / Medium / M | 2.1 | Four relevant solution sources | Segment pages own system fit; use-case pages own workflow; cross-links are explicit and non-duplicative. |
| 2.4 | Expand or consolidate Restaurants based on approved product fit/proof. | P2 / Medium / M | 0.9, 2.1 | restaurants source/config | Route either meets minimum approved product/proof criteria or is consolidated/noindexed with a documented redirect decision. |
| 2.5 | Differentiate five geo pages using only approved local evidence and a shared geo schema. | P2 / Medium / L | 0.9, 2.1 | five geo Markdown files/config | No two geo pages have the same core workflow/proof paragraph; all market/payment claims are approved; all point to beach-club canonical. |
| 2.6 | Redesign About, Help, Support, Careers, and AI landing CTAs by intent. | P2 / Medium / L | 0.4, 0.9 | root landing sources/template | Careers has application CTA; Help has self-service navigation; Support reaches support; About/AI use appropriate secondary conversion; no generic demo close is forced. |

### Phase 3 — comparisons, blog pathways, and long-tail cleanup

| ID | Recommendation | Priority / impact / effort | Dependencies | Affected source | Verifiable acceptance criteria |
|---|---|---|---|---|---|
| 3.1 | Build fair-fit comparison renderer with matrix, fit cards, coexist/switch path, product proof, and verification metadata. | P2 / High / L | 0.4, 0.9 | comparison template/CSS, 10 source files | All tables are semantic/mobile-usable; every claim has current verification metadata; each page links to relevant solution/pillar/demo. |
| 3.2 | Refactor SevenRooms, ResortPass, UrVenue, and Book Tech Labs first. | P1 / High / L | 3.1 | four comparison sources | Priority pages answer fit, product depth, switching/coexistence, commercials, proof, and next action without aggressive claims. |
| 3.3 | Update remaining six comparisons and the Compare hub. | P2 / Medium / L | 3.1 | six sources + hub config | Hub routes by operating model; all comparison facts pass primary-source refresh at implementation time. |
| 3.4 | Add topic-aware article block slots and related mapping. | P2 / High / L | 0.4, 0.8 | blog renderer/CSS/frontmatter | Each post has 3 topic-relevant next steps; no newest-first generic related list remains; editorial body stays source-controlled. |
| 3.5 | Repair and strengthen six editorial pillars/high-intent posts. | P1 / High / L | 3.4 | booking guide, revenue playbook, marketing strategy, guest-list guide, FINNS case, SevenRooms pricing | Each has one product proof, cluster links, canonical product link, and contextual conversion; no broken link remains. |
| 3.6 | Refresh Meta, GA4, dynamic pricing, QR, no-show, and big-match articles. | P2 / Medium / L | 3.4 | six blog sources | Each technical/operational article has a visual explanation and exact approved product boundary. |
| 3.7 | Rewrite or consolidate the five legacy 2025 posts. | P2 / Medium / L | 3.4 | five legacy blog sources + redirect map if consolidated | Banned AI-isms removed; overlapping intent resolved; any removed URL has a permanent, intent-matched redirect. |
| 3.8 | Regenerate sitemap, llms, indices, nav/footer, and all generated output from sources. | P0 / High / S | Phase 0–3 content/template work | Clean build completes; generated diff contains only expected routes; llms/pricing/canonicals match current public facts. |

### Phase 4 — accessibility, responsive, performance, and final verification

| ID | Recommendation | Priority / impact / effort | Dependencies | Affected source | Verifiable acceptance criteria |
|---|---|---|---|---|---|
| 4.1 | Keyboard and screen-reader audit of nav/mega menus, disclosures, demos, consent, modal, form, filters, and tables. | P1 / High / L | Implemented templates | HTML/CSS/JS | Logical focus order; visible focus; correct names/states; no keyboard trap; dialogs restore focus; tables retain headers. |
| 4.2 | Responsive audit at 390, 768, 1024, 1440, and 1920 widths for every template family. | P1 / High / L | Implemented templates | All templates/CSS | No horizontal page overflow; product text remains legible; CTA visible; footer usable; comparison tables have mobile pattern. |
| 4.3 | Reduced-motion, JS-off, and deep-link verification. | P1 / Medium / M | Implemented templates | `js/main.js`, `js/blog.js`, demos, CSS | Content never remains opacity 0; hash targets settle correctly; demos have noninteractive fallback; JS-off CTAs navigate. |
| 4.4 | Performance pass with per-template budgets, responsive images, lazy loading, and route-scoped demo assets. | P1 / High / L | Stable blocks | assets, HTML, CSS, JS | Mobile Lighthouse performance ≥90 on representative pages; LCP ≤2.5s in target test profile; no unused demo bundle on non-demo routes; no layout shift from images/fonts. |
| 4.5 | Final full crawl and metadata/schema verification. | P0 / High / M | All implementation | sitemap, templates, generated output, `.htaccess` | Every declared route tested; 0 broken assets/links/anchors; correct status/canonical/robots; 1 H1/main; unique title/description where intended; legacy redirects permanent. |
| 4.6 | Conversion-flow verification with and without consent choices. | P0 / High / M | 1.8–1.9 | booking/analytics/consent | Demo modal and inline form work after accept/reject/customize; form validation/fallback/scheduler verified; conversion events fire only under correct consent and successful booking state. |

## Verification criteria

The implementation is complete only when all criteria below pass.

### Build and ownership

- `npm run build:blog` succeeds from a clean checkout.
- A second build produces no diff.
- Source Markdown and build config are the only authoring surfaces for generated routes.
- Generated HTML, sitemap, and llms output match the source/config manifest.
- Existing unrelated worktree changes are preserved and never overwritten by bulk regeneration without review.

### Route and link integrity

- Every sitemap URL returns `200` and the intended final content.
- `/booking/`, `/operations/`, and `/intelligence/` return a permanent redirect to a final canonical anchor.
- 0 broken internal destinations, 0 broken assets, and 0 missing fragments.
- No internal content link targets `.html`, `/contact.html`, `/revenue/`, or a legacy route.
- Every generated page has intentional inbound/outbound contextual links independent of global chrome.

### Content and claims

- Brand is “Clubtech” everywhere.
- No banned AI-ism, invented feature, customer, statistic, quote, integration state, or competitor fact is published.
- Dashboard mock values are labeled illustrative wherever visible.
- Every approved capability has exactly one canonical full explanation and supporting inbound links.
- Every `[VERIFY]` item is resolved into approved copy or removed/hidden.
- Comparison facts include verification date and primary-source record during implementation.

### Conversion

- Every commercial page has a relevant primary CTA and at least one path to `/book-a-demo/` after the main proof/value section.
- All Book a Demo triggers have `/book-a-demo/` as non-JavaScript fallback.
- About, Careers, Help, and Support use intent-correct primary actions.
- At 390×844, consent never prevents use of the main CTA or demo form.

### Accessibility and responsive behavior

- One H1 and one main landmark per content page; skip link works.
- Images have meaningful or intentionally empty alt text; product captions explain what to notice.
- Keyboard access and visible focus cover nav, disclosures, filters, demos, form, modal, scheduler fallback, and consent.
- Touch targets are at least 44×44 CSS px where interactive.
- Text and interactive controls meet WCAG 2.2 AA contrast.
- Reduced motion disables decorative/reveal motion without hiding content.
- No page-level horizontal overflow at the target widths; dense comparison tables use an accessible mobile representation.

### Performance

- Representative mobile Lighthouse performance score is at least 90 for homepage, Platform, one solution, one comparison, one article, and Demo.
- LCP is ≤2.5 seconds in the agreed mobile test profile; CLS ≤0.1; INP ≤200 ms where measurable.
- Product/demo assets load only on routes that use them.
- All meaningful images declare dimensions and use appropriately sized responsive sources.
- Self-hosted Albert Sans remains; no third-party font chain is introduced.

## `[VERIFY]` questions and content/asset gaps

### Product and claim questions

1. **Gift cards:** Is this a released, public Clubtech capability? If yes, add it to the approved product fact sheet with exact scope; if no, remove it from public nav/footer/Sell.
2. **Clubtech Reviews:** Is this released and public? Approve exact capabilities and screenshots or remove it from Grow/nav/footer.
3. **Marketing AI:** What behavior is actually AI, versus approved attribution, retargeting, and value-based optimization? Rename unless the AI claim has an explicit source.
4. **AI-agent/MCP bookings:** What works in production today, for whom, and through which public interface? Keep “Emerging” until answered.
5. **Integration roster:** Reconcile Booking Platform names with deck slide 12. For each connector record status (`live`, `available by market`, `custom`, `planned`) and approved public wording.
6. **Hotel folio posting:** Does Opera integration include resident booking charges posted to folio, or only a broader PMS integration? Do not publish the specific flow without confirmation.
7. **Support:** Is there a live passwordless portal? Is WhatsApp an approved support channel or only a product integration? What response/hypercare promises are public outside onboarding?
8. **Restaurant fit:** Which product capabilities and clients support the current experience-led restaurant page beyond the fictional demo? Decide whether to expand or narrow.
9. **Geo evidence:** Which venue/client/operating facts are approved for Dubai, Phuket, Ibiza, and Mykonos? Avoid market generalizations that are not in the approved sources.
10. **Performance claims:** Can production monitoring substantiate sub-second load on representative booking flows? Keep the claim only with ongoing evidence.

### Asset gaps

- Approved 360° walkthrough capture.
- Approved every-guest invitation and guest-detail capture screens.
- Approved abandoned-booking recovery/email/retargeting example.
- Approved payment/deposit/minimum-spend screen.
- Integration architecture or connector-status visual.
- Hotel resident/day-guest/PMS workflow visual.
- Support channel/portal screenshots if the feature is confirmed public.
- Current, rights-cleared team/culture imagery for About/Careers.
- Approved competitor logos/screens only where rights and current accuracy are clear; the comparison system can work without them.
- Responsive image variants for the 0.5–0.7 MB product assets.

### Implementation handoff note

Start with Phase 0 and do not redesign generated pages directly in their emitted HTML. Resolve `[VERIFY]` items before exposing code-only capabilities. Preserve the homepage and pillar design language, use the solution template as the strongest generated-page reference, and make every refactor verifiable through the crawl, responsive screenshots, and clean regeneration criteria above.
