#!/bin/sh
set -e

echo "=== Building Tockler for macOS ==="
cd $CI_PRIMARY_REPOSITORY_PATH/electron

# Build macOS app
pnpm run build_mac

echo "=== Build Output ==="
# ✅ Correct output dir from electron-builder.yml is 'packaged'
ls -la packaged/

# ✅ Create the artifacts dir before copying
mkdir -p $CI_PRIMARY_REPOSITORY_PATH/ci_artifacts/

# ✅ Copy from correct 'packaged' directory
cp -R packaged/ $CI_PRIMARY_REPOSITORY_PATH/ci_artifacts/