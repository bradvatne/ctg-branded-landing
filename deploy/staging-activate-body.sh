# ── ctg-branded-landing staging activation (spliced into the WORK SECTION) ──────
# Flips the `current` symlink to the release tree that release-staging.sh staged,
# fixes ownership, and health-checks with TLS SNI. Rolls back on failure.
SITE_ROOT="/var/www/sites/ctg-landingpage"
REL="__REL_PATH__"                         # release-staging.sh injects the staged release dir
HOSTNAME_FQDN="landingpage.tapbooknow.com"

case "$REL" in
  "$SITE_ROOT"/releases/branded-*) ;;
  *) echo "❌ Refusing: unexpected release path: $REL" >&2; exit 1 ;;
esac
[ -d "$REL/dist/frontend" ] || { echo "❌ Release tree missing: $REL/dist/frontend" >&2; exit 1; }

# Refuse secret-shaped files in the tree before it goes live.
if find "$REL/dist/frontend" \( -name ".env*" -o -name "*_env.php" -o -name "*.key" -o -name "id_rsa*" \) -print | grep -q .; then
  echo "❌ Refusing: secret-shaped file found in release tree" >&2; exit 1
fi

echo "🔧 Normalizing ownership + perms under $REL"
chown -R root:www-data "$REL"
find "$REL" -type d -exec chmod 755 {} +
find "$REL" -type f -exec chmod 644 {} +

PREV="$(readlink -f "$SITE_ROOT/current" 2>/dev/null || true)"
echo "↪  Previous current -> ${PREV:-<none>}"

echo "🔗 Activating: current -> $REL"
ln -sfn "$REL" "$SITE_ROOT/current"

echo "🩺 Health check (TLS SNI via --resolve)"
code="$(curl -s -o /dev/null -w "%{http_code}" \
  --resolve "$HOSTNAME_FQDN:443:127.0.0.1" \
  "https://$HOSTNAME_FQDN/solutions/beach-club-booking-dubai/" || echo 000)"
echo "   /solutions/beach-club-booking-dubai/ -> $code"
if [ "$code" != "200" ]; then
  echo "❌ Health check failed ($code) — rolling back" >&2
  if [ -n "${PREV:-}" ] && [ -d "$PREV" ]; then
    ln -sfn "$PREV" "$SITE_ROOT/current"
    echo "↩  Rolled back current -> $PREV" >&2
  fi
  exit 1
fi
echo "✅ Staging activation OK — current -> $REL"
