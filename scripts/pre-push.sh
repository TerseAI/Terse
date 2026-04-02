#!/usr/bin/env zsh
set -e



cd backend && pnpm run format && cd ..
cd frontend && pnpm run format && cd ..

# Run build in shared
pnpm --prefix shared run build

# Run build in backend
pnpm --prefix backend run build

# Run build in frontend
pnpm --prefix frontend run build

cd backend && npx prisma format && cd ..

echo "Installing workspace dependencies..."
npm install

echo "Running Python validation..."
npm run python:check

# Install terse-sdk and terse-cli globally from the workspace
npm run install-global -w terse-sdk
npm run install-global -w terse-cli

if [[ -d docs ]]; then
  if ! command -v mint >/dev/null 2>&1; then
    echo "Mintlify CLI is required to validate docs before push. Install it with: npm i -g mint"
    exit 1
  fi

  echo "Validating Mintlify docs..."
  cd docs && mint validate && cd ..
fi
