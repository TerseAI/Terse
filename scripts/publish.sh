#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
PACKAGE_NAMES=("terse-types" "terse-sdk" "terse-cli")
PACKAGE_DIRS=("terse-types" "packages/terse-sdk" "packages/terse-cli")
REQUIRED_BRANCH="main"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ─── Argument Parsing ─────────────────────────────────────────────────────────
DRY_RUN=""
OTP_ARG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        --otp)
            OTP_ARG="--otp $2"
            shift 2
            ;;
        --)
            shift
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Usage: publish.sh [--dry-run] [--otp <code>]"
            exit 1
            ;;
    esac
done

# ─── Helpers ──────────────────────────────────────────────────────────────────
get_version() {
    node -p "require('$ROOT_DIR/$1/package.json').version"
}

next_version() {
    local current="$1" bump="$2"
    IFS='.' read -r major minor patch <<< "$current"
    case "$bump" in
        patch) echo "$major.$minor.$((patch + 1))" ;;
        minor) echo "$major.$((minor + 1)).0" ;;
        major) echo "$((major + 1)).0.0" ;;
    esac
}

prompt_bump() {
    local pkg="$1"
    local current="$2"
    echo "" >&2
    echo "  $pkg @ $current" >&2
    echo "    s) skip" >&2
    echo "    p) patch  → $(next_version "$current" patch)" >&2
    echo "    m) minor  → $(next_version "$current" minor)" >&2
    echo "    M) major  → $(next_version "$current" major)" >&2
    read -rp "    Bump [s/p/m/M] (default: skip): " choice
    case "$choice" in
        p) echo "patch" ;;
        m) echo "minor" ;;
        M) echo "major" ;;
        *) echo "skip" ;;
    esac
}

# ─── Pre-flight Checks ───────────────────────────────────────────────────────
echo "=== Terse npm Publish Pipeline ==="
if [[ -n "$DRY_RUN" ]]; then
    echo "  Mode: DRY RUN (nothing will be published)"
fi
echo ""

echo "Pre-flight checks..."

# branch gate
current_branch=$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)
if [[ "$current_branch" != "$REQUIRED_BRANCH" ]]; then
    echo "  ✗ Must publish from '$REQUIRED_BRANCH' (currently on '$current_branch')"
    exit 1
fi
echo "  ✓ On '$REQUIRED_BRANCH' branch"

# npm auth
if ! pnpm whoami 2>/dev/null; then
    echo "  ✗ Not logged into npm. Run 'pnpm login' first."
    exit 1
fi
echo "  ✓ Logged into npm as $(pnpm whoami 2>/dev/null)"

# ─── Version Bumping ─────────────────────────────────────────────────────────
echo ""
echo "Select version bumps:"

BUMPS=()
BUMPED_PACKAGES=()
BUMPED_DIRS=()

for i in "${!PACKAGE_NAMES[@]}"; do
    pkg="${PACKAGE_NAMES[$i]}"
    dir="${PACKAGE_DIRS[$i]}"
    current=$(get_version "$dir")
    bump=$(prompt_bump "$pkg" "$current")
    BUMPS+=("$bump")

    if [[ "$bump" != "skip" ]]; then
        BUMPED_PACKAGES+=("$pkg")
        BUMPED_DIRS+=("$dir")
    fi
done

# Exit early if nothing to publish
if [[ ${#BUMPED_PACKAGES[@]} -eq 0 ]]; then
    echo ""
    echo "No packages selected for publishing. Exiting."
    exit 0
fi

# Apply version bumps
echo ""
echo "=== Bumping versions ==="
COMMIT_PARTS=()

for i in "${!PACKAGE_NAMES[@]}"; do
    pkg="${PACKAGE_NAMES[$i]}"
    dir="${PACKAGE_DIRS[$i]}"
    bump="${BUMPS[$i]}"

    if [[ "$bump" != "skip" ]]; then
        old_version=$(get_version "$dir")
        cd "$ROOT_DIR/$dir"
        npm version "$bump" --no-git-tag-version > /dev/null
        new_version=$(get_version "$dir")
        echo "  $pkg: $old_version → $new_version ($bump)"
        COMMIT_PARTS+=("$pkg@$new_version")
        cd "$ROOT_DIR"
    fi
done

# ─── Confirmation ────────────────────────────────────────────────────────────
echo ""
echo "Will publish: ${BUMPED_PACKAGES[*]}"
read -rp "Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted. Note: version bumps in package.json files have NOT been reverted."
    exit 1
fi

# ─── Build ────────────────────────────────────────────────────────────────────
echo ""
echo "=== Building packages ==="
cd "$ROOT_DIR"
pnpm -r --filter terse-types --filter terse-sdk --filter terse-cli run build

# ─── Publish ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Publishing packages ==="

for pkg in "${BUMPED_PACKAGES[@]}"; do
    echo "Publishing $pkg..."
    # shellcheck disable=SC2086
    pnpm --filter "$pkg" publish --access public --no-git-checks $DRY_RUN $OTP_ARG
done

# ─── Git Commit ───────────────────────────────────────────────────────────────
if [[ -z "$DRY_RUN" ]]; then
    echo ""
    echo "=== Committing version bumps ==="
    cd "$ROOT_DIR"

    for dir in "${BUMPED_DIRS[@]}"; do
        git add "$dir/package.json"
    done

    COMMIT_MSG="chore: release ${COMMIT_PARTS[*]}"
    git commit -m "$COMMIT_MSG"
    echo "  Committed: $COMMIT_MSG"
else
    echo ""
    echo "(Dry run — skipping git commit)"
fi

echo ""
echo "=== Done ==="
