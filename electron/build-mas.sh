#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────────────────────
# Build NasHR Nova for Mac App Store (Universal Binary: arm64 + x64)
# Automatically builds Frontend (client) + Backend (electron) + Packages .pkg
# ─────────────────────────────────────────────────────────────────────────────

APP_NAME="NasHR Nova"
VERSION=$(node -p "require('./package.json').version")
APP_BUNDLE="packaged/mas-universal/${APP_NAME}.app"
PKG_OUTPUT="packaged/NasHR_Nova-${VERSION}-mas-universal.pkg"
INSTALLER_IDENTITY="3rd Party Mac Developer Installer: Danial Ayoob (4Y49KAWKZE)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Building ${APP_NAME} ${VERSION}                     ║"
echo "║   Mac App Store Universal Binary (arm64 + x86_64)   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Step 1: Clean previous builds
echo "▶ Step 1/5: Cleaning previous builds..."
rm -rf packaged/*

# Step 2: Build Frontend Client
echo "▶ Step 2/5: Building Frontend Client (React/Vite)..."
(cd ../client && pnpm build)

# Step 3: Copy Frontend into Electron and Compile Electron Backend
echo "▶ Step 3/5: Copying Frontend into Electron & Compiling Backend..."
pnpm prepare_client
pnpm build

# Step 4: Build and sign Universal MAS App Bundle
echo "▶ Step 4/5: Packaging Universal MAS App Bundle..."
npx electron-builder -c electron-builder.yml --mac mas --universal

if [ ! -d "$APP_BUNDLE" ]; then
    echo "❌ Error: App bundle not found at ${APP_BUNDLE}"
    echo "   Available files in packaged/:"
    ls -la packaged/ packaged/mas-universal/ 2>/dev/null || true
    exit 1
fi

# Step 5: Package into signed .pkg for Transporter
echo "▶ Step 5/5: Creating Universal .pkg installer for Transporter..."
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
echo "║   ✅ BUILD COMPLETE (FRONTEND + BACKEND INCLUDED)    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Package: ${PKG_OUTPUT}"
echo "  Size:    ${PKG_SIZE}"
echo "  Archs:   arm64 (Apple Silicon) + x86_64 (Intel)"
echo ""
echo "  Upload this file to App Store Connect via Transporter:"
echo "  $(pwd)/${PKG_OUTPUT}"
echo ""
