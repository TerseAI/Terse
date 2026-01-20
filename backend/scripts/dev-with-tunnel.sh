#!/bin/bash

# Script to start Smee tunnel, update .env with BACKEND_URL, and optionally start backend server
# Usage: ./dev-with-tunnel.sh [--tunnel-only|-t]
# Requires SMEE_URL to be set in .env file or as an environment variable (e.g., https://smee.io/your-channel)

set -e

# Check for tunnel-only flag
TUNNEL_ONLY=false
if [[ "$1" == "--tunnel-only" ]] || [[ "$1" == "-t" ]]; then
    TUNNEL_ONLY=true
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the backend directory (parent of scripts directory)
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"

# Function to update or add a variable in .env file
update_env_var() {
    local VAR_NAME="$1"
    local VAR_VALUE="$2"
    
    if [ -f "$ENV_FILE" ]; then
        if grep -q "^${VAR_NAME}=" "$ENV_FILE"; then
            # Update existing variable
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s|^${VAR_NAME}=.*|${VAR_NAME}=${VAR_VALUE}|" "$ENV_FILE"
            else
                # Linux
                sed -i "s|^${VAR_NAME}=.*|${VAR_NAME}=${VAR_VALUE}|" "$ENV_FILE"
            fi
        else
            # Append variable to .env
            echo "" >> "$ENV_FILE"
            echo "${VAR_NAME}=${VAR_VALUE}" >> "$ENV_FILE"
        fi
    else
        # Create .env file if it doesn't exist
        echo "${VAR_NAME}=${VAR_VALUE}" > "$ENV_FILE"
    fi
}

# Try to read SMEE_URL from environment variable first (takes precedence), then from .env file
# Check environment variable first (takes precedence) - use printenv to avoid local variable shadowing
SMEE_URL=$(printenv SMEE_URL 2>/dev/null)

# If not set in environment, try reading from .env file
if [ -z "$SMEE_URL" ] && [ -f "$ENV_FILE" ]; then
    # Read SMEE_URL from .env file (handle quoted and unquoted values)
    ENV_SMEE_URL=$(grep "^SMEE_URL=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f2- | sed 's/^["'\'']//; s/["'\'']$//' | xargs)
    if [ -n "$ENV_SMEE_URL" ]; then
        SMEE_URL="$ENV_SMEE_URL"
    fi
fi

# If still not set, show error
if [ -z "$SMEE_URL" ]; then
    echo -e "${RED}❌ Error: SMEE_URL is not set${NC}"
    echo -e "${YELLOW}Please set SMEE_URL in your .env file or as an environment variable${NC}"
    echo -e "${YELLOW}Example: SMEE_URL=https://smee.io/your-channel${NC}"
    echo -e "${YELLOW}You can create a new channel at https://smee.io/new${NC}"
    exit 1
fi

# Validate SMEE_URL format
if [[ ! "$SMEE_URL" =~ ^https://smee\.io/ ]]; then
    echo -e "${RED}❌ Error: SMEE_URL must be a valid Smee URL (e.g., https://smee.io/your-channel)${NC}"
    exit 1
fi

# Save SMEE_URL to .env file so it persists
update_env_var "SMEE_URL" "$SMEE_URL"

echo -e "${BLUE}🚀 Starting Smee tunnel...${NC}"
echo -e "${BLUE}📡 Smee URL: ${SMEE_URL}${NC}"
echo -e "${BLUE}🎯 Target: http://localhost:3001${NC}"

# Start smee in the background
# Using pnpm exec to run smee from devDependencies (v4+ uses 'smee' command)
cd "$BACKEND_DIR"
if command -v pnpm >/dev/null 2>&1 && pnpm exec --help >/dev/null 2>&1; then
    pnpm exec smee -u "$SMEE_URL" -t http://localhost:3001 > /tmp/smee.log 2>&1 &
else
    npx --yes smee-client -u "$SMEE_URL" -t http://localhost:3001 > /tmp/smee.log 2>&1 &
fi
SMEE_PID=$!

# Give smee a moment to start
sleep 2

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down Smee tunnel...${NC}"
    kill $SMEE_PID 2>/dev/null || true
    exit
}

# Trap Ctrl+C and cleanup
trap cleanup INT TERM

# Check if smee process is still running
if ! kill -0 $SMEE_PID 2>/dev/null; then
    echo -e "${RED}❌ Error: Smee tunnel failed to start${NC}"
    echo -e "${YELLOW}Last 20 lines of Smee output:${NC}"
    tail -n 20 /tmp/smee.log 2>/dev/null || echo "No log file found"
    exit 1
fi

echo -e "${GREEN}✅ Smee tunnel is running${NC}"

# Use SMEE_URL as the BACKEND_URL (this is the public URL that services should use)
TUNNEL_URL="$SMEE_URL"

# Update BACKEND_URL in .env file
update_env_var "BACKEND_URL" "$TUNNEL_URL"
echo -e "${GREEN}✅ Updated BACKEND_URL in .env${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🌐 Backend URL: ${TUNNEL_URL}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$TUNNEL_ONLY" = true ]; then
    echo -e "${GREEN}✅ Tunnel is running. Press Ctrl+C to stop.${NC}"
    echo ""
    # Keep the script running and wait for the tunnel process or Ctrl+C
    wait $SMEE_PID || true
    cleanup
else
    echo -e "${BLUE}🚀 Starting backend server...${NC}"
    echo ""
    
    # Start the backend server
    cd "$BACKEND_DIR"
    pnpm run dev
    
    # Cleanup when pnpm run dev exits
    cleanup
fi
