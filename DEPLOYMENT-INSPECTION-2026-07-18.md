# Deployment inspection — Clubtech web estate

**Date:** 2026-07-18 · **Method:** live browser + HTTP inspection, Lighthouse, repo/vault forensics, then an 8-seat leadership-panel review (each seat's output adversarially audited against brand/confidentiality guardrails)
**Scope:** prod (`www.clubtechglobal.com`), branded staging (`landingpage.tapbooknow.com`), repo `ctg-branded-landing@main` (7dd9b0c), Google Ads 870-343-7707, marketing-vault guardrails
**Mode:** inspection only — no code changed, nothing deployed, no CRM records created

---

## 0. Executive summary

**The site this inspection was commissioned for is not the site that is live.** `www.clubtechglobal.com` still serves the *old* ctg-landingpage build (deployed 2026-07-08). The finished, compliant, faster ctg-branded-landing site exists in three places — repo `main`, a one-release-behind staging preview (noindexed), and nowhere a customer or Google can see it.

Meanwhile the money path on the live site is broken: the demo form's `POST /api/lead` returns **502**, the inline scheduler's `/api/availability` returns **503**, and the UI tells the prospect **"You're in. Your details are saved"** while nothing was saved. Google Ads has been paying for clicks into this funnel since 2026-07-08 (~$116 wk-1, 83 clicks) with **zero conversion tracking configured**, so the damage is invisible in every dashboard.

Everything else is in unusually good shape: content compliance is clean on both sites (no confidential commercial figures anywhere, only referenceable clients, claims match Messaging House), and the branded build has real 301s, legal pages, a compliant discovery-framed pricing page, and Lighthouse 84–87 mobile perf against the old site's 64.

**Panel consensus:** fix the lead Worker, then cut over — in days, not weeks — behind a short gate (complete 301 map, staging parity, reconciled cutover script), and turn on conversion measurement the same day. Detail in §5.

---

## 1. Verified-on-prod checks

### 1.1 Deployment state (what is actually serving)

| Surface | What it serves | Evidence |
|---|---|---|
| `www.clubtechglobal.com` | **OLD ctg-landingpage build**, deployed 2026-07-08 | Flat `.html` pillars (`/platform.html`, `/revenue.html`, `/analytics.html`, `/operations.html`, `/mobile.html`, `/about.html`, `/contact.html`, `/customers/finns.html` — all 200); 34-URL old sitemap; `last-modified: 08 Jul 2026`; Geist fonts + periwinkle palette |
| — new-IA routes on prod | **404**: `/platform/`, `/grow/`, `/sell/`, `/delivery/`, `/pricing/`, `/book-a-demo/`, `/terms/`, `/cookies/`, `/privacy/`, `/customers/luna.html`, `/for-hotels/`, `/help/`, `/about/` | curl status sweep 2026-07-18 |
| — exception | The six **Google Ads landing URLs are live** and return 200 (`/`, `/platform.html`, `/solutions/beach-clubs/`, `/solutions/nightclub-table-booking/`, `/compare/urvenue-alternative/`, `/compare/sevenrooms-alternative/`) — old-site-family templates funneling to the broken modal (fallback `/contact.html`) | curl + page-source inspection |
| `landingpage.tapbooknow.com` | **Branded site**, release 2026-07-17 06:13 — the *pre-merge HubSpot-branch tip*, one release behind `main` | `/customers/luna.html` 404 on staging; `git ls-tree 741d7ca customers/` is empty; merge `7dd9b0c` (2026-07-18) adds it |
| — staging correctness | 65-URL sitemap already canonicalized to `www.clubtechglobal.com`; real 301s (`/booking/` → `/platform/#booking` etc.); `/terms/`·`/cookies/`·`/privacy/` live; `robots.txt Disallow: /` (intentional preview noindex) | curl sweep |
| Repo `main` (7dd9b0c) | Branded site + Luna case-study page + `/api/lead` client integration. **Deployed nowhere.** | git log; clean worktree; guarded `deploy-prod.sh` → provision/activate/cutover pipeline ready |

### 1.2 Lead-capture flow, end-to-end (live test with flagged test data)

| Step | Result |
|---|---|
| Prod demo modal ("15 minutes. No pitch deck.") opens, validates | ✅ works |
| Submit → `POST /api/lead` | ❌ **502 Bad Gateway** (Cloudflare HTML error page). Code-level forensics: the repo's new `ctg-lead-capture` Worker has **no 422 response path and no `/api/availability` handler**, yet live prod returns 422 on an empty POST and serves `/api/availability` — so the zone is still running the **old site's `/api/*` worker** (July-8 architecture), now failing upstream on every valid submission. The new `ctg-lead-capture` Worker (merged to `main` today, routes declared for www+apex `/api/lead`) **has not been deployed**. Suspect: the old worker's HubSpot private-app token revoked/rotated or upstream config broken. First diagnostic: `wrangler tail` / Workers logs on the zone. |
| Inline calendar → `GET /api/availability?duration=30` | ❌ **503** — "We couldn't load the calendar just now." |
| UI feedback | ❌ Contradictory: *"Heads up — saving your details hit a snag… email hello@clubtechglobal.com"* **and** *"You're in. Your details are saved"* on the same screen. A prospect reasonably believes Clubtech has their details. It does not. |
| Fallbacks | ✅ "open the scheduler" → `meetings-na2.hubspot.com/gus-murray` loads; ✅ `mailto:hello@clubtechglobal.com` |
| Staging (branded) demo form | Form → embedded HubSpot round-robin scheduler with prefilled name/email: ✅ visible flow completes. But `POST /api/lead` → **404** on this host (Worker routes only exist on the `clubtechglobal.com` zone) — the *primary* server-side CRM capture is silently dead on the preview host, so cutover QA cannot currently validate it anywhere. |
| Branded code behavior (`js/booking.js`) | `sendLead()` is PRIMARY capture, fire-and-forget before the scheduler embed; on failure it only emits a `lead_capture_failed` analytics event. **With the Worker failing, every branded-site lead that doesn't complete a calendar booking would be lost silently.** Fixing the Worker is a hard cutover prerequisite. |
| CRM side-effects of this inspection | None — every test submission failed at the gateway (422/502/404); no HubSpot contact was created. Test data was flagged (`Test Inspection-DeleteMe`, `brad+deploy-inspection-test@clubtechglobal.com`) in case one arrives late. |

### 1.3 Paid traffic reality (vault + live cross-check)

- Two search campaigns live since 2026-07-08: Core Product $10/day (12.8% CTR, $0.94 CPC — healthy) and Competitors $5/day (**$8.62 CPC, still ENABLED despite the 2026-07-15 decision to pause it**).
- Week-1: **$116.15 spend, 738 impressions, 83 clicks, 0 conversions recorded** — Google Ads **conversion actions were never created** (GTM `demo_submit` already fires; `demo_booked` ships with the branded deploy, commit `f333b0f`). Cost-per-demo — the KPI north star — is currently unmeasurable.
- All six ad final URLs return 200 on prod, but every one funnels to the broken `/api/lead` modal.
- Note: live GAQL via the google-ads MCP currently fails needing ADC re-auth (`gcloud auth application-default login`); ad-group statuses above are from the vault's 2026-07-18 verification.

### 1.4 Performance (Lighthouse 13.4, mobile emulation, 2026-07-18)

| Page | Perf | LCP | A11y | Best-practices | SEO |
|---|---|---|---|---|---|
| Prod home (old site) | **64** | **7.8 s** | 96 | 92 | 100 |
| Staging home (branded) | **84** | 3.9 s | **100** | **100** | 69* |
| Staging `/platform/` | **87** | 3.9 s | 95 | 100 | 69* |

\* SEO 69 is caused solely by the intentional staging `Disallow: /`; on prod hosting it would score ~100.
Neither meets the improvement plan's target (perf ≥90, LCP ≤2.5s); the branded site is close (largest remaining lever: the ~314KB `assets/demo/venue-real.webp` hero → mobile `srcset` variant), the old site is not.

### 1.5 Mobile rendering (390×844, fresh profile via Playwright)

- No horizontal overflow on any tested page (prod home, staging home, staging demo, staging pricing).
- Consent: staging = compact bottom card, hero H1 + CTA fully usable (**plan item 1.9 verified fixed on the branded build**). Prod = large (~40% of viewport) but hero H1 and top CTA remain usable.
- Staging `/book-a-demo/` mobile puts value copy above the form ("15 minutes." lands below the fold) — a mobile source-order swap would fix it (Design seat; not a cutover blocker).
- No console errors on either homepage (only a benign CSP report-only notice on prod).

### 1.6 Analytics, consent, legal

- Analytics stack (both sites): GTM `GTM-56T5JJJV` + GA4 + Google Ads `AW-17041977260`, consent-gated (Consent Mode v2), `gclid` captured, first-party GTM proxy at `/metrics/` on prod. HubSpot = server-side capture + consent-gated behavioral pixel only (token never in browser) — good architecture.
- **PostHog is not actually loaded on either site** (only CSP allowances + code comments). If "PostHog analytics" is believed shipped, that belief is wrong — ship it deliberately or strip the residue.
- Consent UX: compliant on both sites (accept-all / reject-non-essential / customize; fresh-visitor test verified).
- **Prod has no privacy policy page** — `/privacy*` 404s and the demo modal's PRIVACY link points to `/cookies.html`. The branded build fixes this. Until cutover, the live site collects lead data with no privacy policy.

---

## 2. Content-claims cross-check (vs Messaging House + 2026-07-17 confidentiality rule)

| Check | Prod (old site) | Staging (branded) |
|---|---|---|
| Clubtech commercial figures (fees, %, setup, monthly, commission) | ✅ none found (full-text sweep) | ✅ none found; `/pricing/` uses the approved discovery-call framing ("Commercials built around your venue… Book a discovery call") |
| Venue-facing prices in product screenshots ($1,500 daybed etc.) | present — **explicitly allowed** | present — allowed |
| Client names | FINNS, Luna, Sol Rooftop + Beau Whittington quote — all referenceable ✅ | FINNS, Luna, Ravana, 4Play, Kàvo, Barra Cuda, lasmari + Beau Whittington — all referenceable ✅ |
| Stats/claims | "82% after 10pm", "sub-second", "four taps" — approved ✅ | Same set + $332k weekly GMV, 7+ countries, 20+ reports — approved ✅ |
| Gated features (Gift cards, Clubtech Reviews, "Marketing AI") | n/a (old IA) | ✅ hidden from nav/pages (repo still ships unused `giftcard.js`/`reviews.js` — cleanup, not compliance, issue) |
| Brand spelling | ✅ "Clubtech" everywhere checked | ✅ |
| Positioning | ⚠️ Hero: "designed for **premium beach clubs**" — narrower than approved multi-vertical positioning; Geist fonts/periwinkle contradict the brand identity | ✅ "Venue booking, operations & revenue capture" matches the Messaging House roof |
| Blog URL parity at cutover | — | ✅ all 14 prod post slugs exist in the branded build (+7 new posts) |

### Cutover gaps found (not in any existing plan)

1. **No redirects for the old indexed flat URLs.** `.htaccess` covers `/booking/`·`/operations/`·`/intelligence/`·`terms/cookies.html` but not the 8 indexed flat pages: `/platform.html`, `/revenue.html`, `/analytics.html`, `/operations.html`, `/mobile.html`, `/about.html`, `/contact.html`, `/customers/finns.html`. All are live-200, in the 34-URL prod sitemap Google indexes today, and **`/platform.html` is an active paid final URL**. At cutover these 404 → paid + organic loss. (Branded build also has no FINNS customer page — only Luna — so `/customers/finns.html` needs an interim target such as `/blog/finns-beach-club-case-study/`.)
2. **Stale cutover health check**: `deploy/prod-cutover.sh:76-78` expects `/pricing/` → 301 `/book-a-demo/`, but the branded site intentionally ships a 200 `/pricing/`. Won't trigger auto-revert, but will print a misleading expectation during the go/no-go moment.
3. **Staging is one release behind main** (missing Luna page) and its zone has no `/api/lead` Worker route — so the exact build + lead path going to prod has never been QA'd end-to-end anywhere.

---

## 3. Leadership panel — 2 high-value changes per seat

Sixteen recommendations from eight role-played seats, grounded in the evidence above. The CEO and Head of Marketing sets were adversarially audited (both passed clean); the remaining six were guardrail-checked inline — two factual nits are noted where they occur.

### CEO

**1. Stop the lead leak: fix or bypass the broken demo pipe this week** *(new — outside the plan's scope)*
Fix the lead-capture Worker on the clubtechglobal.com zone; until verified fixed, repoint the prod demo modal's primary action to the working HubSpot scheduler and remove the false "You're in" success state. Create the Google Ads conversion actions in AW-17041977260 today (`demo_submit` already fires). Execute the unexecuted 07-15 decision: pause the Competitors campaign ($8.62 CPC).
*Why (this seat):* a silent revenue leak + a measurement blackout + an unexecuted owner decision are governance failures, not tickets. Nothing else matters while we pay to fill a broken pipe.
*Impact:* converts the entire ads run-rate from unmeasured-and-leaking to measured-and-working; frees ~$150/month. *Effort:* S (1 day, Brad); M if Worker debugging drags.

**2. Set the cutover date: ship the branded site behind a 3-item gate** *(extends plan 0.6; the cutover decision itself is in no plan)*
Decide this week that ctg-branded-landing replaces the legacy site within ~5 business days, gated on exactly: (1) the flat-URL 301 map + same-day ads final-URL swap; (2) staging redeployed from `main` so QA tests the real build; (3) reconciled `prod-cutover.sh` + `/api/lead` verified on the zone. Explicitly refuse to gate on Lighthouse ≥90 / LCP ≤2.5 — that's post-cutover work.
*Why:* the company's best marketing asset is finished, compliant, on-brand, and invisible, while all traffic lands on a slower site with the wrong identity and no privacy policy. Risk is bounded: the guarded auto-revert pipeline exists and all blog slugs carry over.
*Impact:* all traffic moves to the funnel with perf 84 vs 64, LCP 3.9s vs 7.8s, live privacy policy, 21 vs 14 posts, full-ICP positioning. *Effort:* M (Brad 1–2 days prep; Kaiesh runs the existing scripts).

### COO

**1. Stand up always-on revenue-path monitoring with Slack alerting** *(extends plan 4.5/4.6 from one-time checks to continuous)*
A scheduled synthetic probe every 30–60 min: POST `/api/lead` (reserved probe payload, HubSpot-filtered), GET `/api/availability`, HEAD the scheduler — alerting the existing deploy-watch Slack channel on any non-200. Reuse the ctg-ads-daily-report Cloud Run + Scheduler scaffolding or a Worker cron; extend the ctg-smoke check inventory; make the probe a mandatory post-activation step in `prod-cutover.sh` (which today only curls three static pages).
*Why:* the one path that turns ad spend into pipeline died silently — `worker.js` drops the lead with a `console.warn`, no observability, no alert. The fix for this class of failure is making the next one impossible to miss.
*Impact:* detection window drops from unbounded (this outage's start date is unknown) to under an hour; gives cutover a real go/no-go signal. ~$0/month. *Effort:* S–M (1–2 days, Brad).

**2. Run a weekly open-loops sweep; decisions close only when verified live** *(new — operating cadence, outside the plan)*
Extend the vault's Decision Log into a register where every decision and every "shipped/paused/live" claim carries an owner, an execute-by date, and the exact verification command that proves it; sweep it 15 min/week inside SOP - Weekly Batch. Backfill with the five known open loops: Competitors pause, conversion actions, staging≠main, stale cutover expectation, PostHog claim.
*Why:* every non-code failure found today is the same failure — intention recorded, execution assumed, reality never re-checked. The only existing reconciliation cadence is monthly and non-verifying.
*Impact:* hard 7-day ceiling on decision-to-execution lag; cutover QA can no longer sign off on the wrong build. *Effort:* S (half day + 15 min/week).

### Senior Dev

**1. Restore prod lead capture and make the Worker observable** *(new — the plan has no Worker operations item)*
Identify which Worker actually owns the prod route (live 422-on-empty proves it is NOT current repo code); `npx wrangler tail` while re-sending one failing POST — `worker.js` already logs the HubSpot failure category, pinpointing token-expired vs missing-scope in minutes. Regenerate the HubSpot private-app token (portal 242607066, `crm.objects.contacts.write`), `wrangler secret put HUBSPOT_TOKEN`, `wrangler deploy` current code. Then: `[observability] enabled = true`, a Cloudflare error-rate notification, a daily honeypot-armed synthetic probe + weekly real probe lead, alerting to Slack. Leave `/api/availability` on its scheduler-link fallback; cutover retires it.
*Impact:* reinstates primary CRM capture for 100% of prod form submits; caps future silent-failure windows at <1 day. *Effort:* S (1 day, Brad).

**2. Gate cutover on a real rehearsal: redirects, staging parity, API route** *(extends 0.6 + 0.10/4.5)*
(1) The full legacy 301 map in `.htaccess` (intent-matched: `/platform.html`→`/platform/`, `/revenue.html`→`/sell/`, `/analytics.html`→`/grow/`, `/operations.html`→`/platform/#operations`, `/mobile.html`→`/platform/`, `/contact.html`→`/book-a-demo/`, `/about.html`→`/about/`); (2) fix `prod-cutover.sh` — replace the stale `/pricing/`→301 expectation with assert-200 and add redirect-map + honeypot `/api/lead` assertions; (3) deploy a staging Worker instance (`ctg-lead-capture-staging`, route on the tapbooknow.com zone) so the branded form's primary capture is testable before it takes paid traffic; (4) re-release staging from `main`.
*Impact:* removes the three known ways cutover silently degrades revenue. *Effort:* M (2 days, Brad; Kaiesh only for the sudo run).

### Head of Design

**1. Kill the false "You're in" state; route failures to the scheduler** *(new — the plan governs only the branded repo, not the live prod build)*
Patch the live prod modal to a designed three-state flow (submitting / capture-failed recovery / booked). Success copy renders only on a 2xx; on failure, one recovery state whose primary styled CTA is the working scheduler with email as labeled secondary; while `/api/availability` 503s, don't render the inline calendar at all. Repoint the modal's PRIVACY link (currently `/cookies.html` on a site with no privacy page).
*Why:* a false success converts a recoverable failure (a motivated prospect who'd happily use the scheduler) into a silently lost lead who believes they're booked and stops trying. Design owns the honesty of state feedback, and this is the exact surface every paid click lands on.
*Impact:* failed captures become booked meetings via a verified-working path. *Effort:* S (2–3h spec + <1 day patch on the old deploy path).

**2. Ship the branded cutover behind a one-page design QA gate** *(extends 0.6; re-sequences the plan — cutover before Phases 1–4 polish)*
Declare the branded identity's absence from prod the #1 design defect. One design-owned gate page: brand fidelity (Albert Sans, navy/mint/lime/indigo tokens, venue-wide hero), a 390px pass, honest form states, and the four blockers (flat-URL 301s, Worker fix, reconciled cutover script, six ads URLs 200 post-cutover).
*Why:* the company currently runs two contradictory identities; paying traffic sees the abandoned one. A prospect who clicks today and receives a proposal next week meets two visually different companies at the consideration moment *(inference from the verified mismatch)*.
*Impact:* pre-verified by today's Lighthouse: perf 64→84, LCP 7.8→3.9s, a11y 96→100, real privacy page, compact consent — just by shipping what exists. *Effort:* M.

### Head of Sales

**1. Route all paid demo traffic to the working scheduler; recover lost leads** *(new; extends Phase 4.x with a CRM-receipt probe)*
Same-day triage on prod: point every demo CTA at the verified-working round-robin scheduler; remove the broken calendar + false success until `/api/lead` shows a receipt in HubSpot. Recover: pull GA4 `demo_submit` events since 07-08 and cross-reference HubSpot; Brad personally emails every recoverable lead within 24h ("our form had a fault — here's my calendar"). Harden the now-load-bearing scheduler: add a second round-robin host and confirm APAC availability windows. While in the Ads console: execute the Competitors pause, create the conversion actions. *(Nit: the suggestion to recover payloads from Worker logs won't work — `worker.js` deliberately never logs PII; GA4-vs-CRM reconciliation is the viable route, as the CS seat specifies.)*
*Impact:* every paid click regains a working conversion path same-day; conversion event upgrades from "form fill" to "booked meeting"; recovered leads are the cheapest pipeline available — already paid for, already hand-raised. *Effort:* S + one dev half-day.

**2. Publish the orphaned Luna case study as the demo path's proof spine** *(extends the plan's /book-a-demo/ and FINNS-case-study P1 items; the plan predates this asset)*
`customers/luna.html` (merged today) carries the quantified story sales lacks: 2.1%→7.9% booking conversion and percentage-based results. Verified fully orphaned — zero inbound links, absent from the sitemap, deployed nowhere. Confirm the numbers are cleared as external claims, then: sitemap + links from book-a-demo/homepage/beach-club solution; and without waiting for cutover — PDF leave-behind, a quantified Luna slide beside the FINNS close in the deck, pre-read link in the booking confirmation email, free ad sitelink once live.
*Why:* the sales motion (discovery call → tailored proposal, never public figures) means the case study must carry the quantification burden the pricing page deliberately cannot. FINNS' quote is the only proof a buyer can find today.
*Impact:* every funnel stage gains a quantified proof touch; higher demo-show and proposal-acceptance rates (mechanism-based, no invented numbers). *Effort:* M (2–3 days, Brad + dev assist).

### Head of Marketing

**1. Anchor ads conversion tracking to real bookings, not the broken form** *(new — ads-account config is in no plan; corrects the vault's 07-15 sequencing)*
Create two conversion actions today (AW-17041977260 / GTM-56T5JJJV): **"Demo booked"** (the `demo_booked` event from `f333b0f`, fires on `meetingBookSucceeded`) as PRIMARY, "Demo lead" (`demo_submit`) as secondary/observation-only. Do NOT promote `demo_submit` to primary while `/api/lead` 502s — it fires on submissions whose data never reaches HubSpot, so counting it would record lost leads as wins and later poison Smart Bidding. Connect the native HubSpot–Google Ads integration and verify from CRM records whether gclid survives the off-site scheduler hop. Log action IDs in the vault.
*Impact:* the ~$500/month run-rate becomes measurable cost-per-demo the moment the branded site deploys; prevents a contaminated conversion history. *Effort:* S (~half a day, Brad).

**2. Pause Competitors today; gate ad spend on funnel health** *(new — campaign ops + decision-enforcement tooling)*
Execute the 07-15 decision (campaign 24005504282 — a 15-minute toggle). Hold Core Product at $10/day but scale nothing while the lead path 502s; bank the freed ~$150/month as a pre-committed Core boost for the first two weeks post-cutover (stays under the ceiling). Structurally: add a check to ctg-ads-daily-report that flags any campaign the vault marks "decided: paused" but the account shows ENABLED.
*Impact:* immediately stops ~$5/day of 9×-CPC clicks into a broken path; the drift check costs $0 and removes a recurring failure mode. *Effort:* S (15 min + ~1 hour).

### Head of SEO/Growth

**1. Complete the legacy 301 map to cover every indexed prod URL** *(extends 0.6 + 0.10/4.5)*
301 all 8 indexed flat URLs (including `/customers/finns.html` → `/blog/finns-beach-club-case-study/` interim — a proper FINNS customer page like Luna's is the follow-up, since the deck closes on the FINNS testimonial). Feed the OLD 34-URL sitemap into the crawl harness as a permanent parity gate: every old-sitemap URL must return 200-or-301 on the branded build before cutover. Cutover day: swap the six ads final URLs to new paths (don't ride redirects), submit the 65-URL sitemap in GSC, export a GSC ranking baseline for the flat URLs beforehand so equity transfer is measurable.
*Why:* prod's SEO score is 100 and these 8 URLs are the ONLY equity at risk (everything else carries 1:1). After cutover they 404: paid clicks land on a 404 (+ Ads "destination not working" disapproval risk), pillar rankings evaporate, and the flagship FINNS proof page vanishes with no forwarding address.
*Impact:* the cutover becomes an equity transfer instead of a re-start; pure loss prevention. *Effort:* S (half a day).

**2. Publish the 7 new blog posts to prod now, before cutover** *(new — the plan's cluster work is post-cutover; nothing addresses the pre-cutover indexation window)*
Port the 7 branded-only posts (guest-list cluster ×5, door-QR, sevenrooms-pricing) onto the live old-site blog via the existing ctg-blog-article pipeline at the exact slugs the branded build uses; add to prod sitemap, request indexing, interlink from existing posts. At cutover the branded versions replace content at unchanged URLs — nothing thrown away, no redirects needed. All 7 are compliance-clean (SevenRooms pricing = competitor research, explicitly allowed).
*Why:* indexation takes weeks; every week of cutover slippage is a week these pages earn nothing. Publishing at final URLs starts the clock today and decouples organic growth from cutover risk.
*Impact:* by cutover day the 7 URLs arrive crawled, indexed, and aging instead of starting cold; $0 spend. *Effort:* M (2–3 days). *(If cutover happens within the week per the top-5 ranking, this one's value shrinks — treat as the hedge against slippage.)*

### Head of Customer Success

**1. Reconcile lost demo leads and put owners + SLAs on fallback inboxes** *(extends plan 1.8 with the operational side it lacks)*
Size the loss: GA4 `demo_submit` count 07-08→today vs HubSpot contacts/meetings created (the Worker deliberately logs no PII, so GA4-vs-CRM is the only way). Same-day personal recovery email to anyone identifiable. Assign a named owner + internal response SLA to BOTH live fallback inboxes — `hello@` (prod modal) and `info@` (branded /support/ page) — documented in the vault, internal-only (consistent with the shipped /delivery/ "no published SLA claims" boundary). Until the Worker is fixed: any mailto/scheduler lead is logged into HubSpot within 24h.
*Why:* CS owns what happens after a prospect raises their hand; right now the first experience Clubtech delivers is silence after a false success. Two different unowned mailtos is a support-experience defect, not just link inconsistency.
*Impact:* recovers whatever fraction of ~10 days of paid demo intent is still warm; guarantees zero silent losses; produces the first hard number for what the 502 cost. *Effort:* S (1 day, $0).

**2. Sign off Luna via the Case Study Engine, ship it as proof #2** *(new — the plan has no /customers/ family or proof-capture pipeline)*
Before anything publishes: send Luna one document listing exactly what will appear (name, logo, quotes, each percentage) and file the written approval — the vault still marks Luna's numbers as requiring sign-off even though the client name is deck-referenceable. Then ship it (staging refresh → cutover linking from /book-a-demo/ and /delivery/) and cut the signed-off material into a demo-follow-up slide and 2–3 social proof posts now. Make the /delivery/ 90-day hypercare exit review the standing proof-capture moment (Lasmari next in queue) so /customers/ becomes a repeatable family.
*Why:* proof is the scarcest input in the system; the best proof asset the company owns is one venue sign-off email away from shipping — and publishing without written sign-off would breach the vault's own rule and could burn a referenceable client.
*Impact:* doubles named on-site proof at the decision moment; installs a repeatable proof pipeline. *Effort:* S–M.

---

## 4. Reconciliation with WEBSITE-IMPROVEMENT-PLAN.md

Aggregated panel verdicts on the existing plan (baseline 2026-07-16):

**Strike (obsolete → compliance risk):**
- **1.5** (publish "4% / $2,000" pricing) and the **1.1** "expose exact cleared pricing" clause — overtaken by the 2026-07-17 all-commercials-confidential decision; the shipped discovery-framing `/pricing/` is the correct end state. Also strike the related residue the audit found: line 158 "one Clubtech commercial card" and line 362 "/pricing/ — Public commercials and setup inclusions". Annotate the plan so nobody "completes" these.

**Extend:**
- **0.6** (redirects): scope must include the 8 indexed flat `.html` URLs — near-unanimous across seats; `/platform.html` is an active ads final URL.
- **0.10 / 4.5** (verification harness): add the old 34-URL sitemap as a 200-or-301 parity gate; add the six ads final URLs as named checks; regenerate `prod-cutover.sh` assertions from the current spec; add a synthetic `/api/lead` + CRM-receipt probe (and make it continuous post-launch — plan 4.6 as written runs once).
- **4.4 / 0.2**: add "no gated-feature bundle ships on any route" to acceptance criteria (repo ships unused `giftcard.js`/`reviews.js`/CSS while the features are gated).
- **Phase 4 LCP work**: the branded home already preloads fonts/hero correctly; the remaining LCP lever is a mobile `srcset` variant of the ~314KB hero image.
- **/book-a-demo/ 1.8**: validation must assert CRM receipt, not UI state; converge the two fallback inboxes; add a second scheduler host + APAC windows before scaling spend.
- **Sales extension**: rename the nav label "Commercials" → "Pricing" (the route already is `/pricing/`; buyers scan for "Pricing"; the compliant framing stays untouched).

**Confirm:**
- The plan's core premise (keep the homepage; no site-wide rewrite) — staging quality proves the build is already shippable, which is why perf targets should be post-cutover work, not launch gates.
- **1.9** (mobile consent) — verified fixed on the branded build; adopt as reference implementation and close.
- The plan's topic-cluster design — the 7 new posts already form a coherent guest-list cluster + BOFU competitor-pricing page.
- **New family the plan doesn't know about:** `/customers/` (Luna shipped on `main`, FINNS page exists only on the old site) — needs a home in the IA and the proof-capture pipeline from the CS seat.
- PostHog: wire it or strip the dead CSP allowances/comments before CSP enforcement.

---

## 5. Synthesis — overlap clusters and ranked top 5

**Overlap clusters across seats:**

| Theme | Backed by |
|---|---|
| Fix the live lead pipe (Worker + honest states + scheduler routing + recovery) | CEO, Senior Dev, Design, Sales, CS |
| Cut over now, behind a tight gate (301 map, staging parity, script reconciliation, ads URL swap) | CEO, COO, Senior Dev, Design, Sales, Marketing, SEO |
| Measurement + ads hygiene (conversion actions, Competitors pause, drift check) | Marketing, CEO, Sales, COO |
| Luna case study as proof #2 (sign-off → publish → distribute) | Sales, CS |
| Never fail silently again (synthetic probes, alerting, verified-close cadence) | COO, Senior Dev, Sales, Marketing |

**Top 5 overall:**

**#1 — Restore the lead path on the live site (today/tomorrow).**
`wrangler tail` the zone's `/api/lead` worker → regenerate the HubSpot token → deploy the current `ctg-lead-capture` Worker; simultaneously patch the prod modal to kill the false "You're in" state and promote the working scheduler as primary CTA; run the GA4-vs-HubSpot lost-lead reconciliation and send personal recovery emails. *Backed by 5 seats. Effort: S–M. First step: `npx wrangler tail` while re-sending one flagged test POST.* Every other investment — ads, content, cutover — pours into this pipe.

**#2 — Turn on conversion measurement and execute the ads decisions (same day, ~1 hour).**
Create "Demo booked" (primary) + "Demo lead" (secondary) conversion actions; do not promote `demo_submit` while the form loses data; pause Competitors (24005504282); log both in the vault. *Backed by 4 seats. Effort: S. First step: Google Ads UI → Conversions → new conversion action from GTM.* Without this, nothing else is measurable; with the false-success bug, mis-sequencing it would poison the account's first conversion data.

**#3 — Cut over to the branded site this week, behind a 4-item gate.**
(1) Complete the 301 map for all 8 indexed flat URLs; (2) redeploy staging from `main` and QA there (including a staging Worker route so the lead path is testable); (3) reconcile `prod-cutover.sh` (pricing expectation + new assertions); (4) swap the six ads final URLs + submit the new sitemap in GSC on cutover day. Explicitly not gated on Lighthouse targets. *Backed by 7 seats — the panel's strongest consensus. Effort: M (~2 days prep + Kaiesh's admin run). First step: write the 8-line redirect block in `.htaccess`.*

**#4 — Install always-on revenue-path monitoring + a weekly verified-close cadence.**
Synthetic `/api/lead`/availability/scheduler probe on a 30–60 min schedule alerting Slack (reuse ctg-ads-daily-report scaffolding); make it a `prod-cutover.sh` post-activation step; add the weekly open-loops sweep (Decision Log rows close only with live evidence — backfill the five known loops). *Backed by 4 seats. Effort: S–M. First step: extend ctg-smoke's inventory with the three probes.* This converts today's class of silent failure (502, unexecuted pause, PostHog phantom, staging drift) into ≤1-hour/≤1-week detection loops.

**#5 — Ship the Luna case study through client sign-off, then make it the proof spine.**
Written Luna approval for the exact percentages/quotes → publish at cutover → link from /book-a-demo/, homepage proof band, beach-club solution → deck slide, PDF leave-behind, booking-confirmation pre-read, free ad sitelink. Then institutionalize: proof-capture interview at every 90-day hypercare exit. *Backed by 2 seats (and the sales motion's structural need: discovery-based commercials mean case studies must carry the quantification the pricing page can't). Effort: S–M. First step: the one-page sign-off email to Luna.*

*(Runner-up: pre-publish the 7 new blog posts on the live domain at final URLs — do this only if #3 slips beyond ~a week; otherwise cutover delivers them.)*

---

## 6. Appendix — method and artifacts

- **Live tests performed:** HTTP sweeps (curl) on ~50 routes across prod/staging; browser flow tests via Chrome (prod demo modal submit, staging demo form submit); mobile renders at 390×844 via Playwright (fresh profile); Lighthouse 13.4 mobile on 3 pages; full-text compliance sweeps of saved page HTML; repo git/worktree forensics; vault cross-checks.
- **Side effects:** none on code or deployments. No HubSpot contact was created (all submissions failed at the gateway; test data was flagged for deletion in case one arrives late). One browser-state note: the `ctg-consent` localStorage entry on www.clubtechglobal.com in Brad's Chrome profile was cleared to test the fresh-visitor consent banner — the banner will re-appear once and choices can simply be re-selected.
- **Panel mechanics:** 8 role agents ran with full evidence briefs + repo/vault read access; 2 adversarial audits completed (CEO, Marketing — both passed; only optional wording edits), the remaining 6 audits + machine synthesis hit a session usage limit and were completed by inline review instead. Two factual nits found and noted in place (§3: Sales' Worker-log recovery idea vs the no-PII logging; Marketing's "second execution drift" — the Guest List pause was in fact executed, that episode was reporting lag).
- **Artifacts (session scratchpad):** `lh-*.json` (Lighthouse), `*-mobile.png` (mobile renders), saved page HTML, `panel-results.json` (full 16-recommendation output with per-change evidence). Panel transcripts: `~/.claude/projects/...:209796bb.../subagents/workflows/wf_b9d5f6f7-80e/`.
- **Known tooling note:** the google-ads MCP needs `gcloud auth application-default login` re-auth for live GAQL; ads figures were taken from the vault's same-day verified entries.
