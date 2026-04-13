#!/usr/bin/env zsh
set -e

# Run all format scripts
pnpm run format

# Ensure prisma client is up to date
pnpm --filter backend exec prisma format
pnpm --filter backend exec prisma generate client

# Run all build scripts
pnpm run build

# Run backend prisma format script

echo "Installing workspace dependencies..."
pnpm install

echo "Running Python validation..."
pnpm run python:fix


if [[ -d docs ]]; then
  if ! command -v mint >/dev/null 2>&1; then
    echo "Mintlify CLI is required to validate docs before push. Install it with: npm i -g mint"
    exit 1
  fi

  echo "Validating Mintlify docs..."
  cd docs && mint validate && cd ..
fi
