#!/usr/bin/env zsh
set -e

cd backend && pnpm run format && cd ..
cd frontend && pnpm run format && cd ..

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
