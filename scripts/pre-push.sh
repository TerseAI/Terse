#!/usr/bin/env zsh
set -e

# Run Linter

cd backend && pnpm run format && cd ..
cd frontend && pnpm run format && cd ..

# Run build in backend
pnpm --prefix backend run build

# Run build in frontend
pnpm --prefix frontend run build

cd backend && npx prisma format && cd ..