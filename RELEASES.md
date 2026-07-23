# Releases — ctg-branded-landing

Running log of what shipped to **staging** (`landingpage.tapbooknow.com`), newest first.

**How this works**
- The moving git tag **`staging-live`** marks the commit currently on staging — the deploy watermark.
- `git log staging-live..HEAD` is therefore *everything added since the last push to staging*.
- `scripts/release-staging.sh` cuts a release: it appends the delta below, pushes, stages the tree,
  and generates a Kaiesh activation hand-off whose DEPLOY-WATCH divider carries the delta summary +
  commit link, so **ctg-deploy-watch posts what shipped since the last deploy to Slack**. On land it
  advances `staging-live` to the released commit, so the next delta starts cleanly from here.

<!-- release-log:staging (release-staging.sh inserts new entries directly below this line) -->

## 20260723T233722Z — staging
Commit `4dec665` · 6 change(s) since `e4d7ea6` · [compare](https://github.com/clubtechglobal/ctg-branded-landing/compare/e4d7ea6...4dec665)

- Animate client logo clouds and streamline prod redeploy (`4dec665`)
- fix: gate Google tags behind consent (`0486111`)
- Book-a-demo: reflow sections + fix invisible demo-card heading (`3da6a54`)
- Company stat: bump weekly GMV proof $332k -> $875k across site (`4aef70b`)
- Careers: add open roles listings from Mitra IT talent portal (`ec10307`)
- deploy: fully ignore + exclude design-system tooling dirs (`c4465f3`)

## 20260722T030506Z — staging
Commit `8afa38f` · 2 change(s) since `de4427f` · [compare](https://github.com/clubtechglobal/ctg-branded-landing/compare/de4427f...8afa38f)

- Ads landing: FINNS retargeting image + fix demo scheduler (Indy → Gus) (`8afa38f`)
- Book a Demo: add second inline booking form below FAQ (`39d11bd`)

## 20260721T112614Z — staging
Commit `717f6f6` · 8 change(s) since `a3a0a8c` · [compare](https://github.com/clubtechglobal/ctg-branded-landing/compare/a3a0a8c...717f6f6)

- Reviews: quote-mark watermark, italic quote text, Gabriel GM title (`717f6f6`)
- Lead form: single Name field, new pitch copy, drop fine print (`74b1079`)
- Reviews + client logo strip: Gabriel (Sol Rooftop) quote, venue logo watermarks (`043ec08`)
- Book a Demo: remove modal, all CTAs navigate to /book-a-demo/ (`1385b2b`)
- chore: ignore design-sync tooling artifacts (`a22a032`)
- release: add staging release-cycle tooling (`d0c6d90`)
- solutions/dubai: swap product-band demos to match captions (`3196849`)
- Brand polish: strip pill kickers/eyebrows, fix solutions h1 contrast, nav updates (`5576c5c`)

---

## Baseline — 2026-07-21
- Watermark `staging-live` established at `5576c5c` — "Brand polish: strip pill kickers/eyebrows, fix solutions h1 contrast, nav updates" (what was live on staging when release tracking began).
