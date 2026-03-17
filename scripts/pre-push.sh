#!/usr/bin/env zsh
set -e

cd backend && pnpm run format && cd ..
cd frontend && pnpm run format && cd ..

# Run build in backend
pnpm --prefix backend run build

# Run build in frontend
pnpm --prefix frontend run build

cd backend && npx prisma format && cd ..

# Install terse-sdk and terse-cli globally from the workspace
npm install
npm run install-global -w terse-sdk
npm run install-global -w terse-cli