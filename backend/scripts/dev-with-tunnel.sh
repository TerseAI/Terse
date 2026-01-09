#!/bin/bash

# Script to start cloudflared tunnel, update .env with BACKEND_URL, and optionally start backend server
# Usage: ./dev-with-tunnel.sh [--tunnel-only|-t]

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
NC='\033[0m' # No Color

# Get the backend directory (parent of scripts directory)
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"

echo -e "${BLUE}🚀 Starting cloudflared tunnel...${NC}"

# Start cloudflared tunnel in the background and capture output
# Redirect both stdout and stderr to the log file
cloudflared tunnel --url http://localhost:3001 > /tmp/cloudflared.log 2>&1 &
TUNNEL_PID=$!

# Give cloudflared a moment to start
sleep 2

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down cloudflared tunnel...${NC}"
    kill $TUNNEL_PID 2>/dev/null || true
    exit
}

# Trap Ctrl+C and cleanup
trap cleanup INT TERM

# Wait for tunnel URL to appear in the output
echo -e "${BLUE}⏳ Waiting for tunnel URL...${NC}"
TUNNEL_URL=""
MAX_ATTEMPTS=30
ATTEMPT=0

while [ -z "$TUNNEL_URL" ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
    
    # Try to extract URL from log file
    # Cloudflared outputs URLs like: https://xxxx-xx-xx-xx-xx.trycloudflare.com
    # Use strings to handle any binary characters in the log file
    if [ -f /tmp/cloudflared.log ]; then
        # First try to find URL after "Your quick Tunnel has been created" message
        TUNNEL_URL=$(strings /tmp/cloudflared.log 2>/dev/null | grep -A 1 "Your quick Tunnel has been created" | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -n 1)
        
        # Fallback: try to find any URL in the log
        if [ -z "$TUNNEL_URL" ]; then
            TUNNEL_URL=$(strings /tmp/cloudflared.log 2>/dev/null | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -n 1)
        fi
    fi
done

if [ -z "$TUNNEL_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not extract tunnel URL from cloudflared output${NC}"
    echo -e "${YELLOW}Last 20 lines of cloudflared output:${NC}"
    tail -n 20 /tmp/cloudflared.log 2>/dev/null || echo "No log file found"
    cleanup
    exit 1
fi

echo -e "${GREEN}✅ Tunnel URL: ${TUNNEL_URL}${NC}"

# Update .env file
if [ -f "$ENV_FILE" ]; then
    # Check if BACKEND_URL already exists in .env
    if grep -q "^BACKEND_URL=" "$ENV_FILE"; then
        # Update existing BACKEND_URL
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^BACKEND_URL=.*|BACKEND_URL=$TUNNEL_URL|" "$ENV_FILE"
        else
            # Linux
            sed -i "s|^BACKEND_URL=.*|BACKEND_URL=$TUNNEL_URL|" "$ENV_FILE"
        fi
        echo -e "${GREEN}✅ Updated BACKEND_URL in .env${NC}"
    else
        # Append BACKEND_URL to .env
        echo "" >> "$ENV_FILE"
        echo "BACKEND_URL=$TUNNEL_URL" >> "$ENV_FILE"
        echo -e "${GREEN}✅ Added BACKEND_URL to .env${NC}"
    fi
else
    # Create .env file if it doesn't exist
    echo "BACKEND_URL=$TUNNEL_URL" > "$ENV_FILE"
    echo -e "${GREEN}✅ Created .env file with BACKEND_URL${NC}"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🌐 Backend URL: ${TUNNEL_URL}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$TUNNEL_ONLY" = true ]; then
    echo -e "${GREEN}✅ Tunnel is running. Press Ctrl+C to stop.${NC}"
    echo ""
    # Keep the script running and wait for the tunnel process or Ctrl+C
    wait $TUNNEL_PID || true
    cleanup
else
    echo -e "${BLUE}🚀 Starting backend server...${NC}"
    echo ""
    
    # Start the backend server
    cd "$BACKEND_DIR"
    npm run dev
    
    # Cleanup when npm run dev exits
    cleanup
fi
