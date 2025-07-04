#!/usr/bin/env bash
set -e

# Run build in backend
npm --prefix backend run build

# Run build in frontend
npm --prefix frontend run build

cd backend && npx prisma format && cd ..