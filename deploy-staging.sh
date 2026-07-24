#!/bin/bash
# Stage ctg-branded-landing on the GLN staging box (landingpage.tapbooknow.com).
#
# Post-normalization (2026-07-10) the docroot is root-owned under
# /var/www/sites/ctg-landingpage/current/dist/frontend — direct rsync into the
# live docroot no longer works and activation is root-only. This script builds
# an INSPECTABLE release tree (brad is in www-data; releases/ is group-writable)
# and prints what the activation admin-run must do. Kaiesh flips `current` via
# a scaffolded /tmp/admin-run-*.sh (see the ctg-handoff skill — never hand-write
# the guard scaffolding).
#
# Run from the ctg-dev VM repo checkout.

set -euo pipefail

SITE_ROOT="/var/www/sites/ctg-landingpage"
STAMP="branded-$(date -u +%Y%m%dT%H%M%SZ)"
REL="$SITE_ROOT/releases/$STAMP"

case "$REL" in
  /var/www/sites/ctg-landingpage/releases/*) ;;
  *) echo "❌ Refusing: unexpected release path $REL"; exit 1 ;;
esac

echo "🚀 Staging release $STAMP (landingpage.tapbooknow.com)"

ssh -o BatchMode=yes staging "mkdir -p '$REL/dist/frontend'"

echo "⬆️  Rsyncing site → $REL/dist/frontend"
rsync -e "ssh -o BatchMode=yes" -az --delete --delete-excluded \
  --exclude='.env*' --exclude='logs' --exclude='uploads' --exclude='storage' \
  --exclude='.git/' --exclude='.claude/' --exclude='.DS_Store' \
  --exclude='node_modules/' --exclude='package.json' --exclude='package-lock.json' \
  --exclude='scripts/' --exclude='content/' --exclude='workers/' \
  --exclude='README.md' --exclude='deploy-staging.sh' --exclude='deploy/' \
  --exclude='*.md' --exclude='.gitignore' --exclude='.gitattributes' \
  --exclude='output/' --exclude='.playwright-cli/' --exclude='.vinext/' --exclude='.wrangler/' \
  --exclude='.design-sync/' --exclude='ds/' --exclude='ds-bundle/' --exclude='.ds-sync/' \
  --exclude='__test_probe.js' \
  ./ "staging:$REL/dist/frontend/"

echo "🗂  Preserving SEOdeck (separate repo) + staging robots override"
ssh -o BatchMode=yes staging "
  cp -a '$SITE_ROOT/current/dist/frontend/SEOdeck' '$REL/dist/frontend/SEOdeck' 2>/dev/null || echo '   (no SEOdeck in current release)'
  printf 'User-agent: *\nDisallow: /\n' > '$REL/dist/frontend/robots.txt'
  test ! -e '$REL/dist/frontend/workers'
"

echo ""
echo "✅ Release tree staged (inspectable): $REL"
echo "   Activation is root-only. Scaffold an admin-run via the ctg-handoff skill that:"
echo "     1. verifies the tree + refuses secret-shaped files"
echo "     2. chown -R root:www-data + 755/644"
echo "     3. ln -sfn releases/$STAMP $SITE_ROOT/current"
echo "     4. health-checks with TLS SNI via --resolve landingpage.tapbooknow.com:443:127.0.0.1 and rolls back on failure"
