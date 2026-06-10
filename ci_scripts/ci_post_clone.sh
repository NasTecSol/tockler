#!/bin/sh
set -e

echo "=== Installing Homebrew ==="
# Add NONINTERACTIVE=1 to prevent it from hanging waiting for input
NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

echo "=== Installing Node.js ==="
brew install node

echo "=== Installing pnpm ==="
npm install -g pnpm

echo "=== Building Client (Vite) ==="
cd $CI_PRIMARY_REPOSITORY_PATH/client
pnpm install
pnpm run build

echo "=== Installing Electron deps ==="
cd $CI_PRIMARY_REPOSITORY_PATH/electron
pnpm install

# ✅ ADD THIS — compiles TypeScript before packaging
echo "=== Compiling Electron TypeScript ==="
pnpm run build

echo "=== Copying client dist to electron ==="
pnpm run prepare_client