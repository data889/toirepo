#!/bin/bash
# Install the pmtiles CLI from Protomaps' GitHub Releases.
#
# Protomaps does not maintain an official Homebrew tap (verified 2026-04-19;
# the protomaps/homebrew-tap repository returns 404). Their canonical path
# is the pre-built Go binary on GitHub Releases — see docs.protomaps.com/pmtiles/cli.
#
# Installs to ~/.local/bin (XDG user path, no sudo). Idempotent: if a
# matching version is already installed, exits without redownloading.

set -e

PMTILES_VERSION=1.30.1
INSTALL_DIR="$HOME/.local/bin"
BIN_PATH="$INSTALL_DIR/pmtiles"

# Idempotency: skip if this exact version is already on disk.
if [ -x "$BIN_PATH" ]; then
  CURRENT=$("$BIN_PATH" version 2>/dev/null | head -1 || echo "")
  if echo "$CURRENT" | grep -q "$PMTILES_VERSION"; then
    echo "✅ pmtiles $PMTILES_VERSION already installed: $BIN_PATH"
    exit 0
  else
    echo "⚠️  Existing version differs: $CURRENT — will overwrite"
  fi
fi

# Platform detection
UNAME_S=$(uname -s)
UNAME_M=$(uname -m)
case "$UNAME_S-$UNAME_M" in
  Darwin-arm64) ARCH_TAG="Darwin_arm64" ;;
  Darwin-x86_64) ARCH_TAG="Darwin_x86_64" ;;
  Linux-x86_64) ARCH_TAG="Linux_x86_64" ;;
  *)
    echo "❌ Unsupported platform: $UNAME_S-$UNAME_M"
    echo "   Manual download: https://github.com/protomaps/go-pmtiles/releases/tag/v${PMTILES_VERSION}"
    exit 1
    ;;
esac

FILENAME="go-pmtiles-${PMTILES_VERSION}_${ARCH_TAG}.zip"
URL="https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${FILENAME}"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$TMP_DIR"

echo "📥 Downloading pmtiles $PMTILES_VERSION for $UNAME_S $UNAME_M"
echo "   URL:   $URL"
echo "   Dest:  $BIN_PATH"
echo ""
curl -L --fail --progress-bar -o "$FILENAME" "$URL"

echo "📦 Extracting"
unzip -q "$FILENAME"

if [ ! -f "pmtiles" ]; then
  echo "❌ Unexpected archive layout — no pmtiles binary at top level."
  ls -la
  exit 1
fi

mkdir -p "$INSTALL_DIR"
mv pmtiles "$BIN_PATH"
chmod +x "$BIN_PATH"

cd - > /dev/null

# PATH check — add to ~/.zshrc if missing, and update current session.
case ":$PATH:" in
  *":$INSTALL_DIR:"*)
    PATH_STATUS="already on PATH"
    ;;
  *)
    if [ -f "$HOME/.zshrc" ] && ! grep -q 'HOME/.local/bin' "$HOME/.zshrc"; then
      {
        echo ''
        echo '# Added by toirepo/scripts/install-pmtiles.sh'
        echo 'export PATH="$HOME/.local/bin:$PATH"'
      } >> "$HOME/.zshrc"
      PATH_STATUS="appended to ~/.zshrc"
    else
      PATH_STATUS="NOT on PATH — add to your shell profile manually"
    fi
    export PATH="$INSTALL_DIR:$PATH"
    ;;
esac

echo ""
echo "✅ Installed: $BIN_PATH"
"$BIN_PATH" version
echo ""
echo "ℹ️  $INSTALL_DIR — $PATH_STATUS"
