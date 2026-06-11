#!/bin/sh
set -e

# Install Homebrew non-interactively
NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add Homebrew to PATH for Apple Silicon
if [[ $(uname -m) == 'arm64' ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  eval "$(/usr/local/bin/brew shellenv)"
fi

echo "=== Installing Node.js ==="
brew install node

echo "=== Installing pnpm ==="
npm install -g pnpm

echo "=== Building Client ==="
cd $CI_PRIMARY_REPOSITORY_PATH/client
pnpm install
pnpm build

echo "=== Building Electron ==="
cd $CI_PRIMARY_REPOSITORY_PATH/electron
pnpm install
pnpm build
pnpm prepare_client

echo "=== Done ==="