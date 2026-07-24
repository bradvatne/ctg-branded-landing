#!/usr/bin/env bash
# release-staging.sh — cut a staging release for ctg-branded-landing.
#
# ONE verb for "ship what I have committed to staging". It:
#   1. computes the delta since the last staging release  (git tag `staging-live`)
#   2. appends that delta to RELEASES.md (the running commit log) and commits it
#   3. pushes main to the canonical org remote
#   4. stages the release tree on the staging box          (deploy-staging.sh)
#   5. generates a guarded Kaiesh activation hand-off       (ctg-handoff scaffold.sh)
#      whose DEPLOY-WATCH divider carries the delta summary + REPO/COMMIT, so
#      ctg-deploy-watch posts "what shipped since the last deploy" to Slack
#   6. lands the hand-off on staging /tmp (fires the Slack post) and then
#      advances the `staging-live` watermark to the released commit
#
# THE WATERMARK:  git tag `staging-live` == the commit currently on staging.
#   git log staging-live..HEAD  ==  everything added since the last push to staging.
#
# Root activation itself is run by Kaiesh (we never hold sudo). This script only
# PLACES the guarded hand-off and prints the one command Kaiesh runs.
#
# Usage:
#   scripts/release-staging.sh --dry-run   # show the delta + all it WOULD do; no writes
#   scripts/release-staging.sh             # cut for real (commit, push, stage, land, advance tag)
#
set -euo pipefail

TAG="staging-live"
REPO_SLUG="clubtechglobal/ctg-branded-landing"   # for deploy-watch commit/diff links
CANON_REMOTE="clubtech"                            # org remote = source of truth
HANDOFF_SLUG="branded-landing-activate"
SKILL_SCAFFOLD="$HOME/.claude/skills/ctg-handoff/scripts/scaffold.sh"

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

cd "$(git rev-parse --show-toplevel)"
REPO_DIR="$(pwd)"
BODY_FILE="$REPO_DIR/deploy/staging-activate-body.sh"
[ -r "$BODY_FILE" ] || { echo "missing activation body: $BODY_FILE" >&2; exit 1; }
[ -x "$SKILL_SCAFFOLD" ] || { echo "ctg-handoff scaffold not found: $SKILL_SCAFFOLD" >&2; exit 1; }

# ── preflight ───────────────────────────────────────────────────────────────
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || {
  echo "watermark tag \"$TAG\" does not exist. Seed it once at the commit"
  echo "currently on staging, then re-run:"
  echo "  git tag $TAG <sha-on-staging> && git push $CANON_REMOTE $TAG"
  exit 1
}
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "working tree has uncommitted tracked changes. Commit or stash them"
  echo "first — the deploy ships the tree and the changelog is commit-based;"
  echo "they must match. (RELEASES.md is the only file this script commits.)"
  git status --short
  exit 1
fi

BASE="$(git rev-parse --short "$TAG")"
HEAD_SHA="$(git rev-parse HEAD)"
HEAD_SHORT="$(git rev-parse --short HEAD)"
COUNT="$(git rev-list --count "$TAG"..HEAD)"

if [ "$COUNT" -eq 0 ]; then
  echo "Nothing new since the last staging release ($TAG = $BASE). Nothing to do."
  exit 0
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CHANGELOG="$(git log --no-merges --pretty=format:"- %s (\`%h\`)" "$TAG"..HEAD)"
# single-line summary for the divider WHY (scaffold rejects newlines).
# Use a Bash 3-compatible read loop because macOS still ships Bash 3.2.
SUBJECTS=()
while IFS= read -r subject; do
  SUBJECTS[${#SUBJECTS[@]}]="$subject"
done < <(git log --no-merges --pretty=format:"%s%n" "$TAG"..HEAD)
SUMMARY="$(printf "%s; " "${SUBJECTS[@]:0:3}" | sed "s/; $//")"
[ "${#SUBJECTS[@]}" -gt 3 ] && SUMMARY="$SUMMARY (+$(( ${#SUBJECTS[@]} - 3 )) more)"
COMPARE="https://github.com/$REPO_SLUG/compare/$BASE...$HEAD_SHORT"

RELEASES_ENTRY="$(cat <<ENTRY

## $STAMP — staging
Commit \`$HEAD_SHORT\` · $COUNT change(s) since \`$BASE\` · [compare]($COMPARE)

$CHANGELOG
ENTRY
)"

echo "================================================================"
echo " Staging release delta   $TAG ($BASE) .. HEAD ($HEAD_SHORT)"
echo " $COUNT change(s)"
echo "================================================================"
echo "$CHANGELOG"
echo
echo "Slack WHY (divider):  $SUMMARY"
echo "Compare link:         $COMPARE"
echo "RELEASES.md entry:"
echo "$RELEASES_ENTRY"
echo "----------------------------------------------------------------"

if [ "$DRY" -eq 1 ]; then
  echo "[dry-run] would: append RELEASES.md + commit + push $CANON_REMOTE main"
  echo "[dry-run] would: ./deploy-staging.sh (stage release tree)"
  echo "[dry-run] would: scaffold + fill activation hand-off (WHY carries the summary above)"
  echo "[dry-run] would: land admin-run-$HANDOFF_SLUG-*.sh on staging /tmp (fires Slack post)"
  echo "[dry-run] would: git tag -f $TAG HEAD && git push $CANON_REMOTE $TAG (advance watermark)"
  exit 0
fi

# ── 1/2/3: running log commit + push ─────────────────────────────────────────
MARKER="<!-- release-log:staging"
awk -v entry="$RELEASES_ENTRY" -v marker="$MARKER" \
  'index($0, marker){print; print entry; next} {print}' RELEASES.md > RELEASES.md.tmp
mv RELEASES.md.tmp RELEASES.md
git add RELEASES.md
git commit -q -m "release: staging $STAMP ($COUNT change(s) since $BASE)"
git push -q "$CANON_REMOTE" HEAD:main
RELEASE_COMMIT="$(git rev-parse HEAD)"
echo "RELEASES.md updated + pushed. Release commit: $(git rev-parse --short HEAD)"

# ── 4: stage the release tree ────────────────────────────────────────────────
STAGE_OUT="$(./deploy-staging.sh)"
echo "$STAGE_OUT"
REL="$(printf "%s\n" "$STAGE_OUT" | grep -oE "/var/www/sites/ctg-landingpage/releases/branded-[0-9TZ]+" | head -1)"
[ -n "$REL" ] || { echo "could not determine staged release path from deploy-staging.sh output" >&2; exit 1; }
echo "Staged release: $REL"

# ── 5: generate + fill the Kaiesh activation hand-off ────────────────────────
OUTDIR="$HOME/ctg-deploy/branded-landing"; mkdir -p "$OUTDIR"
GEN_OUT="$("$SKILL_SCAFFOLD" \
  --box staging --slug "$HANDOFF_SLUG" \
  --repo "$REPO_SLUG" --commit "$RELEASE_COMMIT" \
  --title "Activate ctg-branded-landing staging release $STAMP" \
  --why "$SUMMARY" \
  --impact "Flip current -> releases/$(basename "$REL"); $COUNT change(s) since $BASE" \
  --rollback "auto-rolls back to previous release on health-check failure" \
  --out "$OUTDIR")"
echo "$GEN_OUT"
HANDOFF="$(printf "%s\n" "$GEN_OUT" | grep -oE "$OUTDIR/admin-run-$HANDOFF_SLUG-[0-9-]+\.sh" | head -1)"
[ -n "$HANDOFF" ] && [ -f "$HANDOFF" ] || { echo "scaffold did not produce a hand-off script" >&2; exit 1; }

# splice: inject the release path into a copy of the body, then whole-block
# replace the WORK SECTION sentinel (marker-bounded — never quote-splice values)
BODY_TMP="$(mktemp)"; sed "s#__REL_PATH__#$REL#g" "$BODY_FILE" > "$BODY_TMP"
awk -v bodyfile="$BODY_TMP" '
  /WORK SECTION — replace/ {print; while ((getline l < bodyfile) > 0) print l; skip=1; next}
  /END WORK SECTION/ {skip=0; print; next}
  !skip {print}
' "$HANDOFF" > "$HANDOFF.tmp"
mv "$HANDOFF.tmp" "$HANDOFF"; chmod 0755 "$HANDOFF"; rm -f "$BODY_TMP"
bash -n "$HANDOFF" || { echo "bash -n failed on filled hand-off $HANDOFF" >&2; exit 1; }
echo "Activation hand-off ready: $HANDOFF"

# ── 6: land on staging /tmp (fires the Slack post), then advance watermark ───
NAME="$(basename "$HANDOFF")"
LOCAL_SHA="$(sha256sum "$HANDOFF" | cut -d' ' -f1)"
ssh -o BatchMode=yes staging "cat > /tmp/.stage-$NAME" < "$HANDOFF"
REMOTE_SHA="$(ssh -o BatchMode=yes staging "sha256sum /tmp/.stage-$NAME" | cut -d' ' -f1)"
[ "$LOCAL_SHA" = "$REMOTE_SHA" ] || { echo "sha256 mismatch after upload — not landing" >&2; ssh -o BatchMode=yes staging "rm -f /tmp/.stage-$NAME"; exit 1; }
ssh -o BatchMode=yes staging "mv /tmp/.stage-$NAME /tmp/$NAME"
echo "Landed on staging: /tmp/$NAME  (ctg-deploy-watch will post to Slack within ~30s)"

git tag -f "$TAG" HEAD
git push -q -f "$CANON_REMOTE" "$TAG"
echo "Watermark advanced: $TAG -> $(git rev-parse --short HEAD) (pushed to $CANON_REMOTE)"

echo
echo "Release cut. Kaiesh runs the landed hand-off as root; deploy-watch replies"
echo "in-thread with the result + pass/fail reaction when it runs. The exact"
echo "command is printed in the Slack post (run the landed /tmp script with root)."
