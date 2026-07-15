#!/usr/bin/env bash
# admin-run: ctg-branded-landing — production provisioning, one-time per box.
# ===== DEPLOY-WATCH BEGIN =====
# TITLE:  Provision ctg-branded-landing production docroot + vhost (disabled)
# WHY:    One-time: create release dirs + a www.clubtechglobal.com static vhost, left DISABLED until cutover
# IMPACT: Creates /var/www/sites/ctg-branded-landing/{releases,shared}; writes (does NOT enable) ctg-branded-landing-le-ssl.conf; NO live change
# ROLLBACK: rm the vhost file + rm -rf the docroot; nothing was enabled or reloaded
# REPO:   clubtechglobal/ctg-branded-landing
# COMMIT: __COMMIT__
# NOTIFY: kaiesh
# ===== DEPLOY-WATCH END =====
#
# Static site. No PHP, no /api proxy, no /etc/gln env — the booking flow uses
# the HubSpot scheduler embed directly (see js/booking.js). This provisions an
# ISOLATED new docroot and writes a new vhost for www.clubtechglobal.com but
# leaves it DISABLED, so the live site (ctg-landingpage) is untouched. The
# cutover (deploy/prod-cutover.sh) enables this vhost and disables the old one.
#
# TLS: reuses the existing Cloudflare origin cert (wildcard *.clubtechglobal.com)
# already installed on the box. Cert management is Kaiesh/Cloudflare-owned; this
# script only references the existing cert paths and never touches TLS material.
set -euo pipefail

PROD_HOST="sgp1-marketing-prod01"
STAGING_HOST="sgp1-marketingwebsite-staging"
DOMAIN="www.clubtechglobal.com"
APP_BASE="/var/www/sites/ctg-branded-landing"
APP_OWNER="www-data"
CERT_FILE="/etc/ssl/certs/cf-star-clubtechglobal-com.crt"
CERT_KEY="/etc/ssl/private/cf-star-clubtechglobal-com.key"
VH="/etc/apache2/sites-available/ctg-branded-landing-le-ssl.conf"
CREATED_EPOCH=__STAMP__   # replaced with $(date +%s) by deploy-prod.sh at upload

bk(){ [ -e "$1" ] && cp -a "$1" "$1.bak-$(date +%s)" && echo "  backed up $1"; return 0; }

[ "$(id -u)" -eq 0 ] || { echo "run with sudo"; exit 1; }
[ "$(hostname)" != "$STAGING_HOST" ] || { echo "staging host; refusing"; exit 1; }
[ "$(hostname)" = "$PROD_HOST" ] || { echo "wrong host: $(hostname), expected $PROD_HOST"; exit 1; }
[ "$(( $(date +%s) - CREATED_EPOCH ))" -lt 1209600 ] || { echo "script >14d old; regenerate"; exit 1; }
[ -r "$CERT_FILE" ] && [ -r "$CERT_KEY" ] || { echo "TLS cert missing: $CERT_FILE / $CERT_KEY"; exit 1; }

# ── deploy-watch: capture output + signal completion (the ONLY EXIT trap) ─────
DW_SELF="$(readlink -f "${BASH_SOURCE[0]:-$0}")"
DW_LOG="/tmp/$(basename "$DW_SELF" .sh).log"
exec > >(tee -a "$DW_LOG") 2>&1
# shellcheck disable=SC2154 # rc is assigned inside the EXIT trap
trap 'rc=$?; echo "deploy-watch-exit:$rc" >> "$DW_LOG"; [ "$rc" -eq 0 ] && rm -f "$DW_SELF"' EXIT
# ──────────────────────────────────────────────────────────────────────────────

echo "ctg-branded-landing provisioning on $(hostname)"
echo "domain=$DOMAIN base=$APP_BASE (vhost written DISABLED; no live change)"
read -rp "Type PROVISION to continue: " ok
[ "$ok" = "PROVISION" ] || { echo "aborted"; exit 1; }

echo "release skeleton"
mkdir -p "$APP_BASE/releases" "$APP_BASE/shared/logs"
chown -R "$APP_OWNER":www-data "$APP_BASE/shared"
chmod 2775 "$APP_BASE/shared/logs"

echo "Apache modules (static: rewrite/headers/expires/ssl only)"
a2enmod -q rewrite headers expires ssl >/dev/null 2>&1 || true

echo "Apache vhost (written to sites-available, NOT enabled)"
bk "$VH"
cat > "$VH" <<VHOST
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName $DOMAIN
    DocumentRoot $APP_BASE/current
    DirectoryIndex index.html

    <Directory "$APP_BASE/current/">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    <Directory "$APP_BASE/">
        Require all denied
    </Directory>
    <FilesMatch "^\.">
        Require all denied
    </FilesMatch>

    ErrorLog \${APACHE_LOG_DIR}/ctg-branded-landing-error.log
    CustomLog \${APACHE_LOG_DIR}/ctg-branded-landing-access.log combined

    SSLCertificateFile $CERT_FILE
    SSLCertificateKeyFile $CERT_KEY
</VirtualHost>
</IfModule>
VHOST

# Validate the config parses, but DO NOT enable the site or reload — the live
# vhost for $DOMAIN is still ctg-landingpage; enabling a second vhost for the
# same ServerName now would create an overlap. Cutover handles the swap.
apache2ctl configtest

echo "provisioning complete — vhost written but DISABLED"
echo "NEXT: run deploy/prod-activate.sh to populate the first release, then deploy/prod-cutover.sh to go live."
echo "this script self-deletes now"
