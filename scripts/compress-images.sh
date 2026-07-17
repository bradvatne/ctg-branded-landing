#!/usr/bin/env bash
# Recompress oversized hero/product WebP images to <=1600px wide at q80, in place.
# Heroes render <=760px CSS (so 1600px covers retina); the source files were 2-4x
# that. Only replaces a file when the result is actually smaller; originals are in
# git. Requires cwebp (brew install webp) + sips (macOS). Run:
#   bash scripts/compress-images.sh
set -euo pipefail
cd "$(dirname "$0")/.."
command -v cwebp >/dev/null 2>&1 || { echo "cwebp not found (brew install webp)"; exit 1; }
MAXW=1600
Q=80
tb=0; ta=0
shopt -s nullglob
for f in assets/blog/*.webp assets/product/*.webp assets/demo/*.webp; do
  before=$(stat -f%z "$f")
  w=$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth/{print $2}')
  tmp="${f%.webp}.__opt.webp"
  if [ -n "${w:-}" ] && [ "$w" -gt "$MAXW" ]; then
    cwebp -quiet -q "$Q" -resize "$MAXW" 0 "$f" -o "$tmp"
  else
    cwebp -quiet -q "$Q" "$f" -o "$tmp"
  fi
  after=$(stat -f%z "$tmp")
  if [ "$after" -lt "$before" ]; then
    mv "$tmp" "$f"
    printf '  %8d -> %8d  %s\n' "$before" "$after" "$f"
    tb=$((tb+before)); ta=$((ta+after))
  else
    rm -f "$tmp"
    printf '  %8d    (kept)  %s\n' "$before" "$f"
    tb=$((tb+before)); ta=$((ta+before))
  fi
done
printf 'Total: %d -> %d bytes (%d%% saved)\n' "$tb" "$ta" "$(( tb>0 ? (100*(tb-ta)/tb) : 0 ))"
