#!/bin/bash
# Upload ctg-branded-landing production code + guarded admin-run scripts to prod
# /tmp for Kaiesh/root to activate. Mirrors the staging rsync flow but never
# writes the live docroot directly. No tarballs — the source is an inspectable
# directory tree, transported with rsync.
#
# Uploads:
#   /tmp/ctg-branded-landing-src-<timestamp>          (the site source tree)
#   /tmp/admin-run-branded-provision.sh               (deploy/prod-provision.sh)
#   /tmp/admin-run-branded-activate.sh                (deploy/prod-activate.sh)
#   /tmp/admin-run-branded-cutover.sh                 (deploy/prod-cutover.sh)
#
# Run order for Kaiesh/root on the prod host (once each, in order):
#   sudo bash /tmp/admin-run-branded-provision.sh
#   sudo bash /tmp/admin-run-branded-activate.sh /tmp/ctg-branded-landing-src-<timestamp>
#   sudo bash /tmp/admin-run-branded-cutover.sh
#
# Must run from an environment with prod SSH auth (the ctg-prod-ssh VM). The
# Mac key is rejected at the jump by design.
set -euo pipefail

PORT="16308"
JUMP_HOST="139.59.118.191"
REMOTE_USER="brad"
REMOTE_HOST="168.144.141.155"
REMOTE_TMP="/tmp"
APP_NAME="ctg-branded-landing"
# Optional: pin the SSH identity (the prod key). Defaults to the running
# environment's agent/default keys when unset. On the ctg-prod-ssh VM the prod
# key is ~/.ssh/ed25519 — run: PROD_SSH_KEY=~/.ssh/ed25519 ./deploy-prod.sh
PROD_SSH_KEY="${PROD_SSH_KEY:-}"
ID_LINE=""
[ -n "$PROD_SSH_KEY" ] && ID_LINE="IdentityFile $PROD_SSH_KEY
  IdentitiesOnly yes"

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
STAMP_EPOCH="$(date +%s)"
REMOTE_SOURCE_DIR="$REMOTE_TMP/${APP_NAME}-src-$TIMESTAMP"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KNOWN_HOSTS="$ROOT_DIR/known_hosts.deploy"

[ -f "$ROOT_DIR/index.html" ] || { echo "missing index.html; run from repo root"; exit 1; }
[ -f "$ROOT_DIR/book-a-demo/index.html" ] || { echo "missing book-a-demo/index.html"; exit 1; }
[ -f "$KNOWN_HOSTS" ] || { echo "missing $KNOWN_HOSTS; refusing without pinned host keys"; exit 1; }
for s in prod-provision prod-activate prod-cutover; do
  [ -f "$ROOT_DIR/deploy/$s.sh" ] || { echo "missing deploy/$s.sh"; exit 1; }
done
if ls "$ROOT_DIR"/.env* >/dev/null 2>&1; then
  echo "refusing: .env* present in the repo tree; keep prod secrets out"; exit 1
fi

SSH_CONFIG="$(mktemp)"
trap 'rm -f "$SSH_CONFIG"' EXIT
cat > "$SSH_CONFIG" <<SSHCONFIG
Host ctg-branded-prod-jump
  HostName $JUMP_HOST
  Port $PORT
  User $REMOTE_USER
  $ID_LINE
  UserKnownHostsFile $KNOWN_HOSTS
  StrictHostKeyChecking accept-new
  HashKnownHosts no
  ConnectTimeout 10

Host ctg-branded-prod-target
  HostName $REMOTE_HOST
  Port $PORT
  User $REMOTE_USER
  $ID_LINE
  ProxyJump ctg-branded-prod-jump
  UserKnownHostsFile $KNOWN_HOSTS
  StrictHostKeyChecking accept-new
  HashKnownHosts no
  ConnectTimeout 10
SSHCONFIG

SSH_CMD="ssh -F $SSH_CONFIG ctg-branded-prod-target"
RSYNC_SSH="ssh -F $SSH_CONFIG"

case "$REMOTE_SOURCE_DIR" in
  /tmp/ctg-branded-landing-src-*) ;;
  *) echo "refusing suspicious remote source dir: $REMOTE_SOURCE_DIR"; exit 1 ;;
esac

echo "Uploading ctg-branded-landing to production staging area"
echo "  Host:       $REMOTE_HOST:$PORT (via $JUMP_HOST:$PORT)"
echo "  Source dir: $REMOTE_SOURCE_DIR"
echo ""

echo "Preparing remote upload directory"
$SSH_CMD "rm -rf \"$REMOTE_SOURCE_DIR\" && mkdir -p \"$REMOTE_SOURCE_DIR\""

echo "Rsyncing site source (built static tree; excludes tooling + secrets)"
rsync -e "$RSYNC_SSH" -az --delete --delete-excluded \
  --exclude '.git/' --exclude '.claude/' --exclude '.DS_Store' \
  --exclude '.env*' --exclude 'node_modules/' \
  --exclude 'content/' --exclude 'scripts/' --exclude 'deploy/' \
  --exclude 'deploy-staging.sh' --exclude 'deploy-prod.sh' --exclude 'known_hosts.deploy' \
  --exclude 'README.md' --exclude 'package.json' --exclude 'package-lock.json' \
  "$ROOT_DIR/" "ctg-branded-prod-target:$REMOTE_SOURCE_DIR/"

echo "Uploading admin-run scripts (stamped fresh; named for deploy-watch)"
for pair in "prod-provision:admin-run-branded-provision" \
            "prod-activate:admin-run-branded-activate" \
            "prod-cutover:admin-run-branded-cutover"; do
  src="${pair%%:*}"; dst="${pair##*:}"
  # stamp CREATED_EPOCH, land under a temp name, then atomic mv into the
  # admin-run-*.sh name so deploy-watch never scans a half-written file.
  sed "s/CREATED_EPOCH=__STAMP__/CREATED_EPOCH=$STAMP_EPOCH/" "$ROOT_DIR/deploy/$src.sh" \
    | $SSH_CMD "cat > $REMOTE_TMP/.stage-$dst.sh"
  $SSH_CMD "chmod 700 $REMOTE_TMP/.stage-$dst.sh && mv -f $REMOTE_TMP/.stage-$dst.sh $REMOTE_TMP/$dst.sh"
  echo "  landed $REMOTE_TMP/$dst.sh"
done

echo "Verifying uploaded tree"
$SSH_CMD "test -f \"$REMOTE_SOURCE_DIR/index.html\" && test -f \"$REMOTE_SOURCE_DIR/book-a-demo/index.html\" && echo '  tree OK'"

echo ""
echo "Upload complete. Kaiesh/root runs these on prod, in order:"
echo ""
echo "  sudo bash /tmp/admin-run-branded-provision.sh"
echo "  sudo bash /tmp/admin-run-branded-activate.sh $REMOTE_SOURCE_DIR"
echo "  sudo bash /tmp/admin-run-branded-cutover.sh"
echo ""
echo "deploy-watch will post each to Slack. The cutover is the live switch;"
echo "it health-checks www.clubtechglobal.com and auto-reverts on failure."
