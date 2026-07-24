#!/bin/bash
# Upload ctg-branded-landing production code + guarded admin-run scripts to prod
# for Kaiesh/root to activate. This runs on Brad's Mac and transports through
# the dedicated ctg-prod-ssh VM; the repo and rendered scripts never persist in
# that VM. No tarballs — the source is an inspectable directory tree.
#
# Routine redeploy (default; one watched root script):
#   ./deploy-prod.sh --activate-only
#
# First-time host setup/cutover only (three ordered root scripts):
#   ./deploy-prod.sh --initial
#
# Routine redeploy uploads:
#   /home/brad/ctg-deploy/src/ctg-branded-landing-<timestamp> (durable source)
#   /tmp/ctg-branded-landing-src-<timestamp>          (reviewed source copy)
#   /tmp/admin-run-branded-activate-<timestamp>.sh    (deploy/prod-activate.sh)
# Initial mode additionally uploads:
#   /tmp/admin-run-branded-provision-<timestamp>.sh   (deploy/prod-provision.sh)
#   /tmp/admin-run-branded-cutover-<timestamp>.sh     (deploy/prod-cutover.sh)
#
# Initial run order for Kaiesh/root on the prod host (once each, in order):
#   sudo bash /tmp/admin-run-branded-provision-<timestamp>.sh
#   sudo bash /tmp/admin-run-branded-activate-<timestamp>.sh /tmp/ctg-branded-landing-src-<timestamp>
#   sudo bash /tmp/admin-run-branded-cutover-<timestamp>.sh
#
# Run from the Mac repo checkout. Production remains reachable only through
# ctg-prod-ssh; this script refuses when that VM or its prod alias is unavailable.
set -euo pipefail

MODE="${1:---activate-only}"
case "$MODE" in
  --activate-only|--initial) ;;
  *) echo "usage: $0 [--activate-only|--initial]"; exit 1 ;;
esac

REMOTE_TMP="/tmp"
APP_NAME="ctg-branded-landing"
REPO="clubtechglobal/ctg-branded-landing"

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
STAMP_EPOCH="$(date +%s)"
REMOTE_SOURCE_DIR="$REMOTE_TMP/${APP_NAME}-src-$TIMESTAMP"
DURABLE_SOURCE_DIR="/home/brad/ctg-deploy/src/${APP_NAME}-$TIMESTAMP"
PROVISION_SCRIPT="admin-run-branded-provision-$TIMESTAMP.sh"
ACTIVATE_SCRIPT="admin-run-branded-activate-$TIMESTAMP.sh"
CUTOVER_SCRIPT="admin-run-branded-cutover-$TIMESTAMP.sh"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMIT="$(git -C "$ROOT_DIR" rev-parse HEAD)"
RENDER_DIR="$(mktemp -d)"
RSYNC_RSH="$RENDER_DIR/prod-rsh"
trap 'rm -rf "$RENDER_DIR"' EXIT

[ -f "$ROOT_DIR/index.html" ] || { echo "missing index.html; run from repo root"; exit 1; }
[ -f "$ROOT_DIR/book-a-demo/index.html" ] || { echo "missing book-a-demo/index.html"; exit 1; }
REQUIRED_SCRIPTS=(prod-activate)
[ "$MODE" = "--initial" ] && REQUIRED_SCRIPTS=(prod-provision prod-activate prod-cutover)
for s in "${REQUIRED_SCRIPTS[@]}"; do
  [ -f "$ROOT_DIR/deploy/$s.sh" ] || { echo "missing deploy/$s.sh"; exit 1; }
done
if ls "$ROOT_DIR"/.env* >/dev/null 2>&1; then
  echo "refusing: .env* present in the repo tree; keep prod secrets out"; exit 1
fi

# Ship exactly $COMMIT: refuse a dirty working tree and require an explicit branch.
if [ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]; then
  echo "refusing: working tree is dirty — commit or stash so the deploy matches $COMMIT"; exit 1
fi
DEPLOY_BRANCH="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
if [ "$DEPLOY_BRANCH" != "main" ] && [ "${ALLOW_NONMAIN_DEPLOY:-0}" != "1" ]; then
  echo "refusing: on branch '$DEPLOY_BRANCH', not 'main'. Set ALLOW_NONMAIN_DEPLOY=1 to deploy this branch intentionally."; exit 1
fi
echo "  Branch:     $DEPLOY_BRANCH"

command -v limactl >/dev/null 2>&1 || { echo "limactl is required on the Mac"; exit 1; }
# shellcheck disable=SC2016 # hostname/whoami must expand on the production host
limactl shell ctg-prod-ssh -- ssh -o BatchMode=yes -o ConnectTimeout=12 prod \
  'test "$(hostname)" = sgp1-marketing-prod01 && test "$(whoami)" = brad' \
  || { echo "ctg-prod-ssh cannot reach the expected production host as brad"; exit 1; }

prod_ssh() {
  limactl shell ctg-prod-ssh -- ssh -o BatchMode=yes prod "$@"
}

if [ "$MODE" = "--activate-only" ]; then
  prod_ssh "test -L /var/www/sites/ctg-branded-landing/current \
    && test -e /etc/apache2/sites-enabled/ctg-branded-landing-le-ssl.conf" \
    || { echo "activate-only refused: branded current/vhost is not live; inspect before using --initial"; exit 1; }
fi

cat > "$RSYNC_RSH" <<'RSH'
#!/usr/bin/env bash
set -euo pipefail
shift
exec limactl shell ctg-prod-ssh -- ssh -o BatchMode=yes prod "$@"
RSH
chmod 700 "$RSYNC_RSH"

case "$REMOTE_SOURCE_DIR" in
  /tmp/ctg-branded-landing-src-*) ;;
  *) echo "refusing suspicious remote source dir: $REMOTE_SOURCE_DIR"; exit 1 ;;
esac

echo "Uploading ctg-branded-landing to production staging area"
echo "  Host:       sgp1-marketing-prod01 (through ctg-prod-ssh)"
echo "  Commit:     $REPO@$COMMIT"
echo "  Durable:    $DURABLE_SOURCE_DIR"
echo "  Source dir: $REMOTE_SOURCE_DIR"
echo ""

echo "Building an inspectable, secret-free local source tree"
LOCAL_SOURCE_DIR="$RENDER_DIR/source"
mkdir -p "$LOCAL_SOURCE_DIR"
rsync -a --delete --delete-excluded \
  --exclude '.git/' --exclude '.claude/' --exclude '.DS_Store' \
  --exclude '.env*' --exclude 'node_modules/' \
  --exclude 'content/' --exclude 'scripts/' --exclude 'deploy/' --exclude 'workers/' \
  --exclude 'deploy-staging.sh' --exclude 'deploy-prod.sh' --exclude 'known_hosts.deploy' \
  --exclude 'README.md' --exclude 'package.json' --exclude 'package-lock.json' \
  --exclude '*.md' --exclude '.gitignore' --exclude '.gitattributes' \
  --exclude 'output/' --exclude '.playwright-cli/' --exclude '.vinext/' --exclude '.wrangler/' \
  --exclude '.design-sync/' --exclude 'ds/' --exclude 'ds-bundle/' --exclude '.ds-sync/' \
  --exclude '__test_probe.js' \
  "$ROOT_DIR/" "$LOCAL_SOURCE_DIR/"
if find "$LOCAL_SOURCE_DIR" \( -name '.env*' -o -name '*_env.php' -o -name 'wsec_env.php' \
     -o -name 'id_rsa' -o -name 'id_ed25519' -o -name '*.pem' -o -name '*.key' \
     -o -iname '*secret*' -o -iname '*credential*' \) -print -quit | grep -q .; then
  echo "refusing: secret-shaped file present in rendered source"; exit 1
fi
# Belt-and-suspenders: no internal/dev files may reach the public tree.
if find "$LOCAL_SOURCE_DIR" \( -name '*.md' -o -path '*/output/*' \
     -o -path '*/.playwright-cli/*' -o -name '__test_probe.js' \) -print -quit | grep -q .; then
  echo "refusing: internal/dev file (markdown/output/playwright/probe) leaked into rendered source"; exit 1
fi
if [ -e "$LOCAL_SOURCE_DIR/workers" ]; then
  echo "refusing: Worker source leaked into the public site tree"; exit 1
fi
(
  cd "$LOCAL_SOURCE_DIR"
  find . -type f ! -name SHA256SUMS -print0 | LC_ALL=C sort -z \
    | xargs -0 shasum -a 256
) > "$RENDER_DIR/SHA256SUMS"
mv "$RENDER_DIR/SHA256SUMS" "$LOCAL_SOURCE_DIR/SHA256SUMS"

echo "Preparing remote upload directory"
prod_ssh "mkdir -p /home/brad/ctg-deploy/src '$DURABLE_SOURCE_DIR' '$REMOTE_SOURCE_DIR'"

echo "Rsyncing inspectable site source to durable storage"
rsync -e "$RSYNC_RSH" -az --delete "$LOCAL_SOURCE_DIR/" "prod:$DURABLE_SOURCE_DIR/"
prod_ssh "cd '$DURABLE_SOURCE_DIR' && sha256sum -c SHA256SUMS"

echo "Copying reviewed durable source to the watched /tmp handoff area"
prod_ssh "rm -rf '$REMOTE_SOURCE_DIR' && cp -a '$DURABLE_SOURCE_DIR' '$REMOTE_SOURCE_DIR'"

echo "Rendering and landing fresh admin-run script(s)"
SCRIPT_PAIRS=("prod-activate:${ACTIVATE_SCRIPT%.sh}")
if [ "$MODE" = "--initial" ]; then
  SCRIPT_PAIRS=(
    "prod-provision:${PROVISION_SCRIPT%.sh}"
    "prod-activate:${ACTIVATE_SCRIPT%.sh}"
    "prod-cutover:${CUTOVER_SCRIPT%.sh}"
  )
fi
for pair in "${SCRIPT_PAIRS[@]}"; do
  src="${pair%%:*}"; dst="${pair##*:}"
  rendered="$RENDER_DIR/$dst.sh"
  sed -e "s/CREATED_EPOCH=__STAMP__/CREATED_EPOCH=$STAMP_EPOCH/" \
      -e "s/__COMMIT__/$COMMIT/g" \
      -e "s#__SOURCE_DIR__#$REMOTE_SOURCE_DIR#g" \
      -e "s#__ACTIVATE_SCRIPT__#$ACTIVATE_SCRIPT#g" \
      -e "s#__CUTOVER_SCRIPT__#$CUTOVER_SCRIPT#g" \
      "$ROOT_DIR/deploy/$src.sh" > "$rendered"
  if [ "$MODE" = "--activate-only" ] && [ "$src" = "prod-activate" ]; then
    sed -i.bak -e '/^# AFTER:/d' -e '/^echo "NEXT:/d' "$rendered"
    rm -f "$rendered.bak"
  fi
  bash -n "$rendered"
  local_sha="$(shasum -a 256 "$rendered" | awk '{print $1}')"
  prod_ssh "mkdir -p /home/brad/ctg-deploy/steps && cat > '/home/brad/ctg-deploy/steps/$dst.sh'" < "$rendered"
  prod_ssh "cp '/home/brad/ctg-deploy/steps/$dst.sh' '$REMOTE_TMP/.stage-$dst.sh' && chmod 700 '$REMOTE_TMP/.stage-$dst.sh'"
  remote_sha="$(prod_ssh "sha256sum '$REMOTE_TMP/.stage-$dst.sh'" | awk '{print $1}')"
  [ "$local_sha" = "$remote_sha" ] || { echo "checksum mismatch for $dst.sh"; exit 1; }
  prod_ssh "mv -f '$REMOTE_TMP/.stage-$dst.sh' '$REMOTE_TMP/$dst.sh'"
  echo "  landed $REMOTE_TMP/$dst.sh ($local_sha)"
done

echo "Verifying uploaded tree"
prod_ssh "cd '$REMOTE_SOURCE_DIR' && sha256sum -c SHA256SUMS >/dev/null && test -f index.html && test -f book-a-demo/index.html && echo '  manifest + tree OK'"

echo ""
if [ "$MODE" = "--activate-only" ]; then
  echo "Upload complete. Kaiesh/root runs this single production script:"
  echo ""
  echo "  sudo bash /tmp/$ACTIVATE_SCRIPT $REMOTE_SOURCE_DIR"
  echo ""
  echo "deploy-watch will post it to Slack. Activation health-checks"
  echo "www.clubtechglobal.com and auto-rolls back current on failure."
else
  echo "Upload complete. Kaiesh/root runs these on prod, in order:"
  echo ""
  echo "  sudo bash /tmp/$PROVISION_SCRIPT"
  echo "  sudo bash /tmp/$ACTIVATE_SCRIPT $REMOTE_SOURCE_DIR"
  echo "  sudo bash /tmp/$CUTOVER_SCRIPT"
  echo ""
  echo "deploy-watch will post each to Slack. The cutover is the live switch;"
  echo "it health-checks www.clubtechglobal.com and auto-reverts on failure."
fi
