#!/bin/bash
# Deploy ctg-branded-landing to the GLN staging box under
# /var/www/landingpage/dist/frontend — the staging preview of the
# www.clubtechglobal.com cutover. Static site, no build step (blog/
# solutions/compare are prebuilt by scripts/build-blog.mjs and committed).
#
# Public URL: https://landingpage.tapbooknow.com (Cloudflare-proxied,
# shared *.tapbooknow.com origin cert — see staging-server-access skill).
# Vhost / DNS / TLS already wired (003-landingpage-le-ssl.conf).
#
# Run from the ctg-dev VM repo checkout. Modeled on ctg-landingpage's
# deploy-staging.sh; same docroot, same backup + SEOdeck protections.

set -euo pipefail

PORT="16308"
JUMP_HOST="167.71.207.179:$PORT"
REMOTE_USER="brad"
REMOTE_HOST="157.245.62.254"
REMOTE_BASE_DIR="/var/www/landingpage"
REMOTE_DIST_DIR="$REMOTE_BASE_DIR/dist"
REMOTE_FRONTEND_DIR="$REMOTE_DIST_DIR/frontend"
BACKUP_RETENTION_DAYS=14

# Refuse to run if remote paths look wrong — defends against accidental empty
# expansion combined with `rsync --delete` / `chmod -R`.
case "$REMOTE_DIST_DIR" in
  /var/www/landingpage/*) ;;
  *) echo "❌ Refusing: REMOTE_DIST_DIR ($REMOTE_DIST_DIR) is not under /var/www/landingpage/"; exit 1 ;;
esac

TIMESTAMP=$(date +"%y-%m-%d-%H-%M")
BACKUP_DIR="${REMOTE_DIST_DIR}-${TIMESTAMP}"

SSH_CMD="ssh -o StrictHostKeyChecking=accept-new -p $PORT -J $JUMP_HOST"

echo "🚀 Deploying ctg-branded-landing to STAGING (landingpage.tapbooknow.com)..."
echo "   Host:   $REMOTE_HOST (via $JUMP_HOST)"
echo "   Path:   $REMOTE_FRONTEND_DIR"
echo ""

echo "📁 Ensuring remote docroot exists"
$SSH_CMD "$REMOTE_USER@$REMOTE_HOST" "mkdir -p \"$REMOTE_FRONTEND_DIR\""

echo "🔄 Backing up existing dist → $BACKUP_DIR (if any)"
$SSH_CMD "$REMOTE_USER@$REMOTE_HOST" "if [ -d \"$REMOTE_DIST_DIR\" ] && [ \"\$(ls -A \"$REMOTE_DIST_DIR\" 2>/dev/null)\" ]; then cp -a \"$REMOTE_DIST_DIR\" \"$BACKUP_DIR\"; else echo '   (no existing dist, skipping backup)'; fi"

echo "🧽 Pruning backups older than ${BACKUP_RETENTION_DAYS} days"
$SSH_CMD "$REMOTE_USER@$REMOTE_HOST" "find \"$REMOTE_BASE_DIR\" -maxdepth 1 -type d -name 'dist-*' -mtime +${BACKUP_RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true"

echo "⬆️  Rsyncing site → $REMOTE_FRONTEND_DIR"
rsync -e "ssh -o StrictHostKeyChecking=accept-new -p $PORT -J $JUMP_HOST" -avz --delete --delete-excluded \
  --exclude '.git/' --exclude '.claude/' --exclude '.DS_Store' \
  --exclude 'node_modules/' --exclude 'package.json' --exclude 'package-lock.json' \
  --exclude 'scripts/' --exclude 'content/' \
  --exclude 'README.md' --exclude 'deploy-staging.sh' --exclude 'deploy/' \
  --filter='P SEOdeck/' \
  ./ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_FRONTEND_DIR/"
# ^^ SEOdeck/ is the clubtech-discoverability-deck mounted at
#    https://landingpage.tapbooknow.com/SEOdeck — owned by a separate repo.
#    P = protect keeps rsync's --delete sweep from nuking it.

echo "🔖 Stamping cache-bust version (?v=$TIMESTAMP) into every HTML file"
$SSH_CMD "$REMOTE_USER@$REMOTE_HOST" \
  "cd \"$REMOTE_FRONTEND_DIR\" && find . -maxdepth 4 -type f -name '*.html' -exec sed -i -E \
    's#(src|href)=\"((\\.\\./)?(css|js)/[a-z0-9-]+\\.(js|css))\"#\\1=\"\\2?v=$TIMESTAMP\"#g' {} +"

echo "🚫 Overriding robots.txt with disallow-all (STAGING ONLY)"
# The committed robots.txt + canonicals are written for www.clubtechglobal.com.
# The staging host must never be crawled/indexed.
$SSH_CMD "$REMOTE_USER@$REMOTE_HOST" \
  "cd \"$REMOTE_FRONTEND_DIR\" && printf 'User-agent: *\nDisallow: /\n' > robots.txt"

echo "🔒 Setting perms (group www-data, dirs 755, files 644)"
$SSH_CMD "$REMOTE_USER@$REMOTE_HOST" \
  "chgrp -R www-data \"$REMOTE_DIST_DIR\" \
   && find \"$REMOTE_DIST_DIR\" -type d -exec chmod 755 {} + \
   && find \"$REMOTE_DIST_DIR\" -type f -exec chmod 644 {} +"

# Optional Cloudflare cache purge — creds via the wsec keychain bridge
# (work/ctg-landingpage/staging; tapbooknow.com zone). Skips silently when
# wsec isn't on PATH (e.g. running inside the VM) — purge from the Mac then.
if command -v wsec >/dev/null 2>&1; then
  set +x
  eval "$(wsec env-export ctg-landingpage staging 2>/dev/null)" || true
  if [ -n "${CLOUDFLARE_ZONE_ID:-}" ] && [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
    echo "🧹 Purging Cloudflare cache (tapbooknow.com zone, landingpage host)..."
    curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"prefixes": ["landingpage.tapbooknow.com/"]}' >/dev/null
    echo "   done"
  else
    echo "⏭️  CF token/zone not in wsec yet; skipping purge"
  fi
  unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ZONE_ID
else
  echo "⏭️  wsec not on PATH; skipping Cloudflare purge"
fi

echo ""
echo "✅ Files staged at $REMOTE_FRONTEND_DIR"
echo "   Live at: https://landingpage.tapbooknow.com/"
