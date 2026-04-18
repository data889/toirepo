#!/bin/bash
# Extract a Tokyo-region subset from the full planet pmtiles on T7 Shield.
# Uses pmtiles CLI 1.30.1's `--bbox` + `--maxzoom` flags (verified against
# `pmtiles extract --help`).

set -e

DATA_DIR="/Volumes/T7 Shield/toirepo-data"
INPUT="$DATA_DIR/raw/planet.pmtiles"
OUTPUT="$DATA_DIR/processed/tokyo.pmtiles"

# Tokyo metro bbox: west, south, east, north.
# Covers 東京都 23区 plus the greater Tokyo commuter belt (Saitama border
# south, Yokohama / Kawasaki north, Chiba west edge). This is a safety
# margin; the first viewable MVP app will be centered on 東京駅.
BBOX="138.9,35.3,140.2,35.95"

# Max zoom 16. zoom 0-15 is the Protomaps planet default; 16 is the
# highest useful zoom for street-level navigation. Going beyond 16 is
# usually overkill for toilet discovery UX.
MAX_ZOOM=16

if [ ! -f "$INPUT" ]; then
  echo "❌ $INPUT does not exist."
  echo "   Run \`pnpm pmtiles:download\` first."
  exit 1
fi

if ! command -v pmtiles &> /dev/null; then
  echo "❌ pmtiles CLI not found on PATH."
  echo "   Run \`pnpm pmtiles:install\` first."
  exit 1
fi

mkdir -p "$DATA_DIR/processed"

# pmtiles extract refuses to overwrite — remove stale output first.
if [ -f "$OUTPUT" ]; then
  echo "⚠️  $OUTPUT already exists — removing for fresh extract"
  rm "$OUTPUT"
fi

echo "🗾 Extracting Tokyo region"
echo "   Input:    $INPUT"
echo "   Output:   $OUTPUT"
echo "   Bbox:     $BBOX"
echo "   Max zoom: $MAX_ZOOM"
echo ""

pmtiles extract "$INPUT" "$OUTPUT" --bbox="$BBOX" --maxzoom=$MAX_ZOOM

FINAL_H=$(du -h "$OUTPUT" | cut -f1)
FINAL_BYTES=$(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null)

echo ""
echo "✅ Extract complete"
echo "   Size: $FINAL_H ($FINAL_BYTES bytes)"
echo ""
echo "Next: pnpm pmtiles:upload"
