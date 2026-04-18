#!/bin/bash
# Download the latest Protomaps planet pmtiles to the external SSD.
# Supports resume via curl -C - so interrupted runs pick up where they left off.

set -e

# Build channel: Protomaps retains the last week of daily builds at
# build.protomaps.com/YYYYMMDD.pmtiles. 20260418 was the newest available
# build at time of this script. Bump this when refreshing data — pick the
# newest date that HEAD returns 200 for.
PMTILES_BUILD_DATE="20260418"
PMTILES_URL="https://build.protomaps.com/${PMTILES_BUILD_DATE}.pmtiles"

DATA_DIR="/Volumes/T7 Shield/toirepo-data"
OUTPUT_FILE="$DATA_DIR/raw/planet.pmtiles"

if [ ! -d "/Volumes/T7 Shield" ]; then
  echo "❌ T7 Shield is not mounted."
  exit 1
fi

mkdir -p "$DATA_DIR/raw"

echo "📦 Downloading Protomaps planet.pmtiles"
echo "   Build:    $PMTILES_BUILD_DATE"
echo "   URL:      $PMTILES_URL"
echo "   Target:   $OUTPUT_FILE"
echo "   Disk:     T7 Shield external SSD"
echo ""

if [ -f "$OUTPUT_FILE" ]; then
  EXISTING_BYTES=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo 0)
  EXISTING_H=$(du -h "$OUTPUT_FILE" | cut -f1)
  echo "⏯  Existing file: $EXISTING_H ($EXISTING_BYTES bytes) — will attempt resume"
  echo ""
fi

# curl -C - : resume from last byte if server supports Range
# curl --fail : exit non-zero on HTTP error
# curl --progress-bar : human-readable progress
curl -L -C - --fail --progress-bar -o "$OUTPUT_FILE" "$PMTILES_URL"

FINAL_BYTES=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
FINAL_H=$(du -h "$OUTPUT_FILE" | cut -f1)

echo ""
echo "✅ Download complete"
echo "   Size: $FINAL_H ($FINAL_BYTES bytes)"
echo ""
echo "Next: pnpm pmtiles:extract"
