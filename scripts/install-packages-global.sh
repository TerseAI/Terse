#!/usr/bin/env zsh
set -e

echo "Installing workspace dependencies..."
npm install

echo "Linking terse-sdk globally..."
npm run install-global -w terse-sdk

echo "Linking terse-cli globally..."
npm run install-global -w terse-cli

echo "Done!"
