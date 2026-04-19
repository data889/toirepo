#!/bin/bash
# Download Protomaps planet.pmtiles to external SSD.
# Uses HTTP/1.1 + aggressive retry to survive CDN stream resets.
# Supports resume via `curl -C -`.
set -e

# Protomaps publishes weekly builds at build.protomaps.com/YYYYMMDD.pmtiles.
# To update: check https://build.protomaps.com/ for the newest available date,
# bump PMTILES_BUILD_DATE below, and commit.
PMTILES_BUILD_DATE=20260418
PMTILES_URL="https://build.protomaps.com/${PMTILES_BUILD_DATE}.pmtiles"

DATA_DIR="/Volumes/T7 Shield/toirepo-data"
OUTPUT_FILE="$DATA_DIR/raw/planet.pmtiles"

if [ ! -d "/Volumes/T7 Shield" ]; then
  echo "❌ T7 Shield not mounted"
  exit 1
fi

mkdir -p "$DATA_DIR/raw"

echo "📦 Downloading Protomaps planet.pmtiles"
echo "   URL:     $PMTILES_URL"
echo "   Target:  $OUTPUT_FILE"
echo ""

if [ -f "$OUTPUT_FILE" ]; then
  EXISTING_BYTES=$(stat -f%z "$OUTPUT_FILE")
  EXISTING_GB=$(echo "scale=1; $EXISTING_BYTES / 1073741824" | bc)
  echo "⏯  Partial file: ${EXISTING_GB}GB (${EXISTING_BYTES} bytes) — will resume"
  echo ""
fi

# --http1.1: Protomaps CDN resets HTTP/2 streams on long transfers; HTTP/1.1 is stable
# --retry 999 + --retry-all-errors: keep retrying on any transient failure
# --retry-delay 5: wait 5s between retries
# --retry-max-time 0: no cap on total retry time
# -C -: resume from current file size
curl -L -C - \
  --http1.1 \
  --retry 999 \
  --retry-all-errors \
  --retry-delay 5 \
  --retry-max-time 0 \
  --fail \
  --progress-bar \
  -o "$OUTPUT_FILE" \
  "$PMTILES_URL"

echo ""
echo "✅ Download complete"
echo "   Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "Next: pnpm pmtiles:extract"
