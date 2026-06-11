#!/bin/sh
set -e

echo "=== Packaging Electron for Mac App Store ==="
cd $CI_PRIMARY_REPOSITORY_PATH/electron

export ELECTRON_BUILDER_SILENT=true
export CSC_IDENTITY_AUTO_DISCOVERY=true

# Build MAS package
pnpm release --mac mas

echo "=== Build Output ==="
ls -la packaged/

# Upload to App Store Connect using Apple ID
PKG_PATH=$(find packaged -name "*.pkg" | head -n 1)

if [ -z "$PKG_PATH" ]; then
  echo "No .pkg found"
  exit 1
fi

echo "Uploading: $PKG_PATH"

xcrun altool --upload-app \
  -f "$PKG_PATH" \
  -t macos \
  -u "$APPLE_ID" \
  -p "$APPLE_APP_SPECIFIC_PASSWORD" \
  --output-format xml

echo "Upload complete"