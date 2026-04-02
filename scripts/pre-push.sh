#!/usr/bin/env zsh
set -e

# Run all format scripts
pnpm run format

# Run all build scripts
pnpm run build

# Run backend prisma format script
pnpm exec --filter backend prisma format

echo "Installing workspace dependencies..."
pnpm install

echo "Running Python validation..."
pnpm run python:check


if [[ -d docs ]]; then
  if ! command -v mint >/dev/null 2>&1; then
    echo "Mintlify CLI is required to validate docs before push. Install it with: npm i -g mint"
    exit 1
  fi

  echo "Validating Mintlify docs..."
  cd docs && mint validate && cd ..
fi
