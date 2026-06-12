#!/bin/sh
set -e

echo "========================================"
echo "=== Xcode Cloud: Post Xcodebuild     ==="
echo "========================================"

# ─────────────────────────────────────────
# 1. Go to electron directory
# ─────────────────────────────────────────
cd $CI_PRIMARY_REPOSITORY_PATH/electron

# ─────────────────────────────────────────
# 2. Set build environment
# ─────────────────────────────────────────
export ELECTRON_BUILDER_SILENT=true
export CSC_IDENTITY_AUTO_DISCOVERY=true

# ─────────────────────────────────────────
# 3. Detect architecture
# ─────────────────────────────────────────
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  BUILD_ARCH="arm64"
else
  BUILD_ARCH="x64"
fi
echo "Building for architecture: $BUILD_ARCH"

# ─────────────────────────────────────────
# 4. Build Mac App Store package
# ─────────────────────────────────────────
echo "=== Building Electron for Mac App Store ==="
pnpm release --mac mas --$BUILD_ARCH

# ─────────────────────────────────────────
# 5. Verify build output
# ─────────────────────────────────────────
echo "=== Build Output ==="
ls -la packaged/ || echo "packaged folder not found"

# ─────────────────────────────────────────
# 6. Find the .pkg file
# ─────────────────────────────────────────
PKG_PATH=$(find packaged -name "*.pkg" | head -n 1)

if [ -z "$PKG_PATH" ]; then
  echo "Error: No .pkg file found in packaged/"
  exit 1
fi

echo "Found package: $PKG_PATH"

# ─────────────────────────────────────────
# 7. Upload to App Store Connect
#    APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD
#    must be set in Xcode Cloud env variables
# ─────────────────────────────────────────
echo "=== Uploading to App Store Connect ==="

if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
  echo "Error: APPLE_ID or APPLE_APP_SPECIFIC_PASSWORD not set"
  echo "Please add these in Xcode Cloud → Workflow → Environment"
  exit 1
fi

xcrun altool --upload-app \
  -f "$PKG_PATH" \
  -t macos \
  -u "$APPLE_ID" \
  -p "$APPLE_APP_SPECIFIC_PASSWORD" \
  --output-format xml

echo "========================================"
echo "=== Upload Complete!                 ==="
echo "========================================"