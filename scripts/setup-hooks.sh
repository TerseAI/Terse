#!/usr/bin/env bash
set -e

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
cp "$(dirname "$0")/pre-push.sh" "$HOOK_DIR/pre-push"
chmod +x "$HOOK_DIR/pre-push"
echo "pre-push hook installed"
