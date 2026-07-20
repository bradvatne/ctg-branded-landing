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

---

## Baseline — 2026-07-21
- Watermark `staging-live` established at `5576c5c` — "Brand polish: strip pill kickers/eyebrows, fix solutions h1 contrast, nav updates" (what was live on staging when release tracking began).
