#!/usr/bin/env bash
# admin-run: ctg-branded-landing — production CUTOVER, one-time go-live.
# ===== DEPLOY-WATCH BEGIN =====
# TITLE:  Cut www.clubtechglobal.com over to ctg-branded-landing
# WHY:    Make the static branded site the live www.clubtechglobal.com (replaces ctg-landingpage)
# IMPACT: a2ensite branded + a2dissite ctg-landingpage + reload Apache; THIS is the live switch
# ROLLBACK: a2dissite branded && a2ensite ctg-landingpage && systemctl reload apache2 (auto on health fail; command printed)
# REPO:   clubtechglobal/ctg-branded-landing
# COMMIT: __COMMIT__
# NOTIFY: kaiesh
# AFTER:  Verify https://www.clubtechglobal.com/ and https://www.clubtechglobal.com/book-a-demo/
# ===== DEPLOY-WATCH END =====
#
# Prereq: prod-provision.sh (docroot + disabled vhost) and prod-activate.sh
# (populated current) have both run. This swaps the enabled vhost for the domain
# from the old ctg-landingpage site to the branded one, health-checks the live
# domain, and auto-rolls-back the vhost swap on any failure. The old docroot is
# left intact for instant manual rollback.
set -euo pipefail

PROD_HOST="sgp1-marketing-prod01"
STAGING_HOST="sgp1-marketingwebsite-staging"
DOMAIN="www.clubtechglobal.com"
APP_BASE="/var/www/sites/ctg-branded-landing"
NEW_SITE="ctg-branded-landing-le-ssl"          # a2ensite name (no .conf)
OLD_SITE="ctg-landingpage-le-ssl"              # the currently-live site to disable
VH_AVAIL="/etc/apache2/sites-available/${NEW_SITE}.conf"
CREATED_EPOCH=__STAMP__   # replaced with $(date +%s) by deploy-prod.sh at upload

[ "$(id -u)" -eq 0 ] || { echo "run with sudo"; exit 1; }
[ "$(hostname)" != "$STAGING_HOST" ] || { echo "staging host; refusing"; exit 1; }
[ "$(hostname)" = "$PROD_HOST" ] || { echo "wrong host: $(hostname), expected $PROD_HOST"; exit 1; }
[ "$(( $(date +%s) - CREATED_EPOCH ))" -lt 1209600 ] || { echo "script >14d old; regenerate"; exit 1; }

# Prerequisites must be in place.
[ -f "$VH_AVAIL" ]                       || { echo "missing $VH_AVAIL; run prod-provision first"; exit 1; }
[ -L "$APP_BASE/current" ]               || { echo "$APP_BASE/current not set; run prod-activate first"; exit 1; }
[ -f "$APP_BASE/current/index.html" ]    || { echo "$APP_BASE/current has no index.html; run prod-activate first"; exit 1; }
[ -f "$APP_BASE/current/book-a-demo/index.html" ] || { echo "branded current missing book-a-demo; run prod-activate first"; exit 1; }

# ── deploy-watch: capture output + signal completion (the ONLY EXIT trap) ─────
DW_SELF="$(readlink -f "${BASH_SOURCE[0]:-$0}")"
DW_LOG="/tmp/$(basename "$DW_SELF" .sh).log"
exec > >(tee -a "$DW_LOG") 2>&1
# shellcheck disable=SC2154 # rc is assigned inside the EXIT trap
trap 'rc=$?; echo "deploy-watch-exit:$rc" >> "$DW_LOG"; [ "$rc" -eq 0 ] && rm -f "$DW_SELF"' EXIT
# ──────────────────────────────────────────────────────────────────────────────

echo "ctg-branded-landing CUTOVER on $(hostname) — $DOMAIN -> $APP_BASE/current"
OLD_WAS_ENABLED=0
[ -e "/etc/apache2/sites-enabled/${OLD_SITE}.conf" ] && OLD_WAS_ENABLED=1
echo "old site ($OLD_SITE) currently enabled: $OLD_WAS_ENABLED"

revert() {
  echo "REVERTING vhost swap"
  a2dissite -q "$NEW_SITE" >/dev/null 2>&1 || true
  [ "$OLD_WAS_ENABLED" = "1" ] && a2ensite -q "$OLD_SITE" >/dev/null 2>&1 || true
  apache2ctl configtest && systemctl reload apache2 || echo "  ⚠ reload after revert failed — inspect manually"
}

echo "enable branded vhost, disable old vhost"
a2ensite  -q "$NEW_SITE"  >/dev/null 2>&1 || true
a2dissite -q "$OLD_SITE"  >/dev/null 2>&1 || true

echo "configtest"
if ! apache2ctl configtest; then
  echo "configtest FAILED — reverting"; revert; exit 1
fi

echo "reload apache"
systemctl reload apache2

echo "health-check live $DOMAIN"
code="$(curl -ksS --resolve "$DOMAIN:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || echo 000)"
demo="$(curl -ksS --resolve "$DOMAIN:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$DOMAIN/book-a-demo/" || echo 000)"
# /pricing/ must now redirect (301) to /book-a-demo/ via .htaccess
predir="$(curl -ksS --resolve "$DOMAIN:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$DOMAIN/pricing/" || echo 000)"
echo "health: / = $code ; /book-a-demo/ = $demo ; /pricing/ = $predir (expect 200/200/301)"
if [ "$code" != "200" ] || [ "$demo" != "200" ]; then
  echo "health FAILED — reverting to $OLD_SITE"; revert
  code2="$(curl -ksS --resolve "$DOMAIN:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || echo 000)"
  echo "post-revert / = $code2"
  exit 1
fi

# ── Cloudflare cache purge (best-effort; keys from shared env.conf) ───────────
CF_TOKEN="$(awk '$1=="SetEnv" && $2=="CF_PURGE_TOKEN" {gsub(/"/,"",$3); print $3}' /etc/gln/env.conf 2>/dev/null || true)"
CF_ZONE="$(awk '$1=="SetEnv" && $2=="CF_ZONE_ID" {gsub(/"/,"",$3); print $3}' /etc/gln/env.conf 2>/dev/null || true)"
if [ -n "$CF_TOKEN" ] && [ -n "$CF_ZONE" ]; then
  echo "cloudflare: purging zone cache"
  if curl -sS -m 20 -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" \
       -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
       --data '{"purge_everything":true}' | grep -q '"success": *true'; then
    echo "  cloudflare purge OK"
  else
    echo "  ⚠ cloudflare purge FAILED (non-fatal — purge manually in the CF dashboard)"
  fi
else
  echo "cloudflare purge skipped (CF_PURGE_TOKEN/CF_ZONE_ID not in env.conf)"
fi

echo "✅ CUTOVER COMPLETE — $DOMAIN now serves ctg-branded-landing"
echo "rollback (if needed): sudo a2dissite $NEW_SITE && sudo a2ensite $OLD_SITE && sudo systemctl reload apache2"
echo "this script self-deletes now"
