#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────────────────────
# Build Nova for Mac App Store and package it as a .pkg for Transporter upload
# ─────────────────────────────────────────────────────────────────────────────

APP_NAME="Nova"
VERSION=$(node -p "require('./package.json').version")
APP_BUNDLE="packaged/mas-arm64/${APP_NAME}.app"
PKG_OUTPUT="packaged/${APP_NAME}-${VERSION}-mas-arm64.pkg"
INSTALLER_IDENTITY="3rd Party Mac Developer Installer: Danial Ayoob (4Y49KAWKZE)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Building Nova ${VERSION} for Mac App Store         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Step 1: Build and sign the MAS app bundle with electron-builder
echo "▶ Step 1/2: Building and signing the MAS app bundle..."
npx electron-builder -c electron-builder.yml --mac mas

if [ ! -d "$APP_BUNDLE" ]; then
    echo "❌ Error: App bundle not found at ${APP_BUNDLE}"
    exit 1
fi

echo "✅ App bundle built and signed: ${APP_BUNDLE}"
echo ""

# Step 2: Package the MAS-signed .app into a .pkg using Apple's productbuild
# This is the ONLY correct way to create a .pkg for Transporter from a MAS build.
echo "▶ Step 2/2: Creating .pkg installer for Transporter..."
productbuild \
    --component "${APP_BUNDLE}" /Applications \
    --sign "${INSTALLER_IDENTITY}" \
    "${PKG_OUTPUT}"

if [ ! -f "$PKG_OUTPUT" ]; then
    echo "❌ Error: PKG file not found at ${PKG_OUTPUT}"
    exit 1
fi

PKG_SIZE=$(du -sh "${PKG_OUTPUT}" | cut -f1)

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✅ BUILD COMPLETE                                  ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Package: ${PKG_OUTPUT}"
echo "  Size:    ${PKG_SIZE}"
echo ""
echo "  Upload this file to App Store Connect via Transporter:"
echo "  $(pwd)/${PKG_OUTPUT}"
echo ""
