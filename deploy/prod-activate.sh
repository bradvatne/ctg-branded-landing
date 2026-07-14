#!/usr/bin/env bash
# admin-run: ctg-branded-landing — production activate, every deploy.
# ===== DEPLOY-WATCH BEGIN =====
# TITLE:  Activate ctg-branded-landing release
# WHY:    Publish an inspected /tmp source tree as the live release in the branded docroot
# IMPACT: Creates releases/<stamp>, flips current symlink, prunes old releases (NO vhost change)
# ROLLBACK: ln -sfn <prev> current (printed at end of run)
# REPO:   bradvatne/ctg-branded-landing
# NOTIFY: kaiesh
# ===== DEPLOY-WATCH END =====
#
# Static site — no PHP, no shared blog runtime, no /api. Pre-cutover the branded
# vhost is DISABLED, so flipping current is invisible to the live site; a domain
# health-check only runs once the branded vhost is the enabled one for the domain
# (i.e. after deploy/prod-cutover.sh), for subsequent re-deploys.
set -euo pipefail

PROD_HOST="sgp1-marketing-prod01"
STAGING_HOST="sgp1-marketingwebsite-staging"
DOMAIN="www.clubtechglobal.com"
APP_BASE="/var/www/sites/ctg-branded-landing"
APP_OWNER="${SUDO_USER:-www-data}"
VH_ENABLED="/etc/apache2/sites-enabled/ctg-branded-landing-le-ssl.conf"
KEEP=5
SOURCE="${1:-}"
CREATED_EPOCH=__STAMP__   # replaced with $(date +%s) by deploy-prod.sh at upload

[ "$(id -u)" -eq 0 ] || { echo "run with sudo"; exit 1; }
[ "$(hostname)" != "$STAGING_HOST" ] || { echo "staging host; refusing"; exit 1; }
[ "$(hostname)" = "$PROD_HOST" ] || { echo "wrong host: $(hostname), expected $PROD_HOST"; exit 1; }
[ "$(( $(date +%s) - CREATED_EPOCH ))" -lt 1209600 ] || { echo "script >14d old; regenerate"; exit 1; }
[ -d "$APP_BASE/releases" ] || { echo "$APP_BASE/releases missing; run prod-provision first"; exit 1; }

# Source is ALWAYS an inspectable directory — tarballs are never a deploy unit.
if [ -z "$SOURCE" ]; then
  mapfile -t found < <(find /tmp -maxdepth 1 -type d -name 'ctg-branded-landing-src-*' -printf '%T@ %p\n' 2>/dev/null | sort -rn | awk '{print $2}')
  if [ "${#found[@]}" -eq 1 ]; then SOURCE="${found[0]}"; else
    echo "pass the source dir explicitly; found ${#found[@]} /tmp/ctg-branded-landing-src-* dirs"; exit 1
  fi
fi
case "$SOURCE" in
  /tmp/ctg-branded-landing-src-*) ;;
  *) echo "refusing source outside /tmp/ctg-branded-landing-src-* (tarballs not accepted): $SOURCE"; exit 1 ;;
esac
[ -d "$SOURCE" ] || { echo "source is not a directory: $SOURCE"; exit 1; }

# ── deploy-watch: capture output + signal completion (the ONLY EXIT trap) ─────
DW_SELF="$(readlink -f "${BASH_SOURCE[0]:-$0}")"
DW_LOG="/tmp/$(basename "$DW_SELF" .sh).log"
exec > >(tee -a "$DW_LOG") 2>&1
trap 'rc=$?; echo "deploy-watch-exit:$rc" >> "$DW_LOG"; [ "$rc" -eq 0 ] && rm -f "$DW_SELF"' EXIT
# ──────────────────────────────────────────────────────────────────────────────

echo "ctg-branded-landing activate on $(hostname)"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REL="$APP_BASE/releases/$STAMP"
mkdir -p "$REL"
[ -f "$SOURCE/index.html" ] || { echo "source tree has no index.html: $SOURCE"; rm -rf "$REL"; exit 1; }
[ -f "$SOURCE/book-a-demo/index.html" ] || { echo "source tree has no book-a-demo/index.html (wrong/old tree?)"; rm -rf "$REL"; exit 1; }

echo "copy source dir -> $REL"
cp -a "$SOURCE/." "$REL/"

echo "remove non-runtime files from the release"
rm -rf "$REL/.git" "$REL/.claude" "$REL/node_modules" "$REL/content" "$REL/scripts" "$REL/deploy"
rm -f  "$REL"/deploy-prod.sh "$REL"/deploy-staging.sh "$REL"/known_hosts.deploy \
       "$REL"/README.md "$REL"/package.json "$REL"/package-lock.json "$REL"/.gitignore \
       "$REL"/CLAUDE*.md "$REL"/WORKING_MEMORY.md "$REL"/INSTRUCTIONS.md

echo "perms (root:www-data, dirs 755, files 644)"
chown -R "$APP_OWNER":www-data "$REL"
find "$REL" -type d -exec chmod 755 {} +
find "$REL" -type f -exec chmod 644 {} +

# Release-content sanity: the pieces that make this the branded build.
for f in index.html book-a-demo/index.html 404.html .htaccess pricing/index.html; do
  [ -e "$REL/$f" ] || { echo "release missing $f; refusing"; rm -rf "$REL"; exit 1; }
done

PREV="$(readlink "$APP_BASE/current" 2>/dev/null || true)"
echo "flip current -> $STAMP"
ln -sfn "$REL" "$APP_BASE/current.tmp"
mv -Tf "$APP_BASE/current.tmp" "$APP_BASE/current"

echo "prune old releases (keep $KEEP)"
( cd "$APP_BASE/releases" && ls -1dt */ 2>/dev/null | tail -n +$((KEEP+1)) | while read -r d; do
    [ "$APP_BASE/releases/${d%/}" = "$PREV" ] && continue
    rm -rf -- "${d%/}"
  done ) || true

# Domain health-check ONLY when the branded vhost is already live (post-cutover
# re-deploy). Pre-cutover the branded vhost is disabled and the domain still
# serves ctg-landingpage, so a domain check would be meaningless.
if [ -e "$VH_ENABLED" ]; then
  echo "branded vhost is live — health $DOMAIN/"
  code="$(curl -ksS --resolve "$DOMAIN:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || echo 000)"
  demo="$(curl -ksS --resolve "$DOMAIN:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$DOMAIN/book-a-demo/" || echo 000)"
  echo "health: / = $code ; /book-a-demo/ = $demo"
  if [ "$code" != "200" ] || [ "$demo" != "200" ]; then
    echo "health failed; rolling back current"
    if [ -n "$PREV" ] && [ -d "$PREV" ]; then
      ln -sfn "$PREV" "$APP_BASE/current.tmp"; mv -Tf "$APP_BASE/current.tmp" "$APP_BASE/current"
    fi
    exit 1
  fi
else
  echo "branded vhost not yet enabled — skipping domain health-check (this is expected pre-cutover)"
fi

echo "deployed $STAMP"
echo "rollback: sudo ln -sfn ${PREV:-<prev>} $APP_BASE/current.tmp && sudo mv -Tf $APP_BASE/current.tmp $APP_BASE/current"
echo "this script self-deletes now"
