#!/bin/sh
set -e

echo "========================================"
echo "=== Xcode Cloud: Post Clone Script   ==="
echo "========================================"

# ─────────────────────────────────────────
# 1. Install Homebrew (non-interactive)
# ─────────────────────────────────────────
echo "=== Installing Homebrew ==="
NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add Homebrew to PATH (Apple Silicon vs Intel)
if [[ $(uname -m) == 'arm64' ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
else
  eval "$(/usr/local/bin/brew shellenv)"
fi

echo "Homebrew installed: $(brew --version)"

# ─────────────────────────────────────────
# 2. Install Node.js
# ─────────────────────────────────────────
echo "=== Installing Node.js ==="
brew install node
echo "Node installed: $(node --version)"
echo "npm installed: $(npm --version)"

# ─────────────────────────────────────────
# 3. Install pnpm
# ─────────────────────────────────────────
echo "=== Installing pnpm ==="
npm install -g pnpm
echo "pnpm installed: $(pnpm --version)"

# ─────────────────────────────────────────
# 4. Build Client (Vite / React)
# ─────────────────────────────────────────
echo "=== Building Client ==="
cd $CI_PRIMARY_REPOSITORY_PATH/client
pnpm install
pnpm build
echo "Client build complete"

# ─────────────────────────────────────────
# 5. Install Electron Dependencies
# ─────────────────────────────────────────
echo "=== Installing Electron Dependencies ==="
cd $CI_PRIMARY_REPOSITORY_PATH/electron
pnpm install
echo "Electron deps installed"

# ─────────────────────────────────────────
# 6. Compile Electron TypeScript
# ─────────────────────────────────────────
echo "=== Compiling Electron TypeScript ==="
pnpm build
echo "Electron TypeScript compiled"

# ─────────────────────────────────────────
# 7. Copy Client dist into Electron
# ─────────────────────────────────────────
echo "=== Copying client dist to Electron ==="
pnpm prepare_client
echo "Client dist copied"

echo "========================================"
echo "=== Post Clone Script Complete       ==="
echo "========================================"