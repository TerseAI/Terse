#!/usr/bin/env zsh
set -e

echo "Installing terse-sdk globally..."
pnpm --prefix packages/terse-sdk run install-global

echo "Installing terse-cli globally..."
pnpm --prefix packages/terse-cli run install-global

echo "Done!"
