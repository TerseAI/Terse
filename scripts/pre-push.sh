#!/usr/bin/env zsh
set -e

# Source shell profile to get proper PATH (nvm, fnm, volta, etc.)
if [[ -f "$HOME/.zshrc" ]]; then
  source "$HOME/.zshrc"
fi

# Run Linter

cd backend && pnpm run format && cd ..
cd frontend && pnpm run format && cd ..

# Run build in backend
pnpm --prefix backend run build

# Run build in frontend
pnpm --prefix frontend run build

cd backend && npx prisma format && cd ..