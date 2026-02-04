#!/usr/bin/env zsh
set -e

# Run build in backend
pnpm --prefix backend run build

# Run build in frontend
pnpm --prefix frontend run build

cd backend && npx prisma format && cd ..