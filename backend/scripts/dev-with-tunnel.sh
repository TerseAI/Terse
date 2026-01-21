#!/bin/bash

# Script to start ngrok tunnel, update .env with BACKEND_URL, and optionally start backend server
# Usage: ./dev-with-tunnel.sh [--tunnel-only|-t]
# Requires NGROK_AUTH_TOKEN to be set (optional, for persistent URLs)

set -e
# Enable error tracing for debugging
set -o pipefail

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

# Check if ngrok is installed
if ! command -v ngrok >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: ngrok is not installed${NC}"
    echo -e "${YELLOW}Please install ngrok:${NC}"
    echo -e "${YELLOW}  macOS: brew install ngrok/ngrok/ngrok${NC}"
    echo -e "${YELLOW}  Or download from: https://ngrok.com/download${NC}"
    exit 1
fi

# Check for NGROK_AUTH_TOKEN (required for reserved domains)
NGROK_AUTH_TOKEN=$(printenv NGROK_AUTH_TOKEN 2>/dev/null || true)
if [ -z "$NGROK_AUTH_TOKEN" ] && [ -f "$ENV_FILE" ]; then
    # Read from .env file - handle cases with or without quotes
    ENV_LINE=$(grep "^NGROK_AUTH_TOKEN=" "$ENV_FILE" 2>/dev/null | head -n 1 || true)
    if [ -n "$ENV_LINE" ]; then
        NGROK_AUTH_TOKEN=$(echo "$ENV_LINE" | cut -d '=' -f2- | sed -e 's/^[" ]*//' -e 's/[" ]*$//' || true)
    fi
fi

# Check for NGROK_DOMAIN (reserved domain for persistent URL)
NGROK_DOMAIN=$(printenv NGROK_DOMAIN 2>/dev/null || true)
if [ -z "$NGROK_DOMAIN" ] && [ -f "$ENV_FILE" ]; then
    # Read from .env file - handle cases with or without quotes
    ENV_LINE=$(grep "^NGROK_DOMAIN=" "$ENV_FILE" 2>/dev/null | head -n 1 || true)
    if [ -n "$ENV_LINE" ]; then
        NGROK_DOMAIN=$(echo "$ENV_LINE" | cut -d '=' -f2- | sed -e 's/^[" ]*//' -e 's/[" ]*$//' || true)
    fi
fi


if [ -z "$NGROK_AUTH_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  NGROK_AUTH_TOKEN not set${NC}"
    echo -e "${YELLOW}   Without an auth token, you'll have limited session time and random URLs${NC}"
    echo -e "${YELLOW}   Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken${NC}"
    echo -e "${YELLOW}   Add it to your .env file: NGROK_AUTH_TOKEN=your_token_here${NC}"
    echo ""
else
    # Configure ngrok with auth token
    ngrok config add-authtoken "$NGROK_AUTH_TOKEN" >/dev/null 2>&1 || true
    echo -e "${GREEN}✅ ngrok auth token configured${NC}"
fi

if [ -z "$NGROK_DOMAIN" ]; then
    echo -e "${YELLOW}⚠️  NGROK_DOMAIN not set - URL will change each time${NC}"
    echo -e "${YELLOW}   To get a persistent URL, reserve a domain at: https://dashboard.ngrok.com/cloud-edge/domains${NC}"
    echo -e "${YELLOW}   Then set NGROK_DOMAIN in your .env file (e.g., NGROK_DOMAIN=your-domain.ngrok-free.app)${NC}"
    echo ""
fi

echo -e "${BLUE}🚀 Starting ngrok tunnel...${NC}"
echo -e "${BLUE}🎯 Target: http://localhost:3001${NC}"
if [ -n "$NGROK_DOMAIN" ]; then
    echo -e "${BLUE}🔒 Using reserved domain: ${NGROK_DOMAIN}${NC}"
fi

# Kill any existing ngrok processes first
pkill -f "ngrok.*3001" 2>/dev/null || true
sleep 1

# Start ngrok in the background
cd "$BACKEND_DIR"
if [ -n "$NGROK_DOMAIN" ]; then
    # Use reserved domain for persistent URL
    echo -e "${BLUE}Starting ngrok with domain: ${NGROK_DOMAIN}${NC}"
    ngrok http 3001 --domain="$NGROK_DOMAIN" --log=stdout > /tmp/ngrok.log 2>&1 &
else
    # Use random URL (will change each time)
    echo -e "${BLUE}Starting ngrok with random URL${NC}"
    ngrok http 3001 --log=stdout > /tmp/ngrok.log 2>&1 &
fi
NGROK_PID=$!

# Give ngrok a moment to start
sleep 3

# Check if ngrok process started successfully
if ! kill -0 $NGROK_PID 2>/dev/null; then
    echo -e "${RED}❌ Error: ngrok process failed to start${NC}"
    echo -e "${YELLOW}Last 20 lines of ngrok output:${NC}"
    tail -n 20 /tmp/ngrok.log 2>/dev/null || echo "No log file found"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down ngrok tunnel...${NC}"
    kill $NGROK_PID 2>/dev/null || true
    pkill -f "ngrok.*3001" 2>/dev/null || true
    exit
}

# Trap Ctrl+C and cleanup
trap cleanup INT TERM

# Check if ngrok process is still running
if ! kill -0 $NGROK_PID 2>/dev/null; then
    echo -e "${RED}❌ Error: ngrok tunnel failed to start${NC}"
    echo -e "${YELLOW}Last 20 lines of ngrok output:${NC}"
    tail -n 20 /tmp/ngrok.log 2>/dev/null || echo "No log file found"
    exit 1
fi

# Extract the public URL from ngrok API (local API runs on 4040)
echo -e "${BLUE}⏳ Waiting for ngrok URL...${NC}"
TUNNEL_URL=""
MAX_ATTEMPTS=10
ATTEMPT=0

while [ -z "$TUNNEL_URL" ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
    
    # Try to get URL from ngrok local API
    API_RESPONSE=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null || echo "")
    if [ -n "$API_RESPONSE" ]; then
        # Try to extract URL from JSON response
        TUNNEL_URL=$(echo "$API_RESPONSE" | grep -oE '"public_url":"https://[^"]+' | cut -d'"' -f4 | head -n 1)
        if [ -z "$TUNNEL_URL" ]; then
            # Fallback: try regex pattern
            TUNNEL_URL=$(echo "$API_RESPONSE" | grep -oE 'https://[a-zA-Z0-9-]+\.ngrok(-free|-dev)?\.app' | head -n 1)
        fi
    fi
done

if [ -z "$TUNNEL_URL" ]; then
    if [ -n "$NGROK_DOMAIN" ]; then
        # If we have a reserved domain, construct the URL
        TUNNEL_URL="https://${NGROK_DOMAIN}"
        echo -e "${YELLOW}⚠️  Could not verify URL from API, using configured domain: ${TUNNEL_URL}${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not extract ngrok URL automatically${NC}"
        echo -e "${YELLOW}Please check ngrok web interface at http://localhost:4040${NC}"
        echo -e "${YELLOW}Or check logs: tail -f /tmp/ngrok.log${NC}"
        cleanup
        exit 1
    fi
fi

echo -e "${GREEN}✅ ngrok tunnel is running${NC}"
echo -e "${GREEN}🌐 Public URL: ${TUNNEL_URL}${NC}"
echo -e "${BLUE}📋 Slack Events URL: ${TUNNEL_URL}/slack/events${NC}"

# Update BACKEND_URL in .env file
update_env_var "BACKEND_URL" "$TUNNEL_URL"
echo -e "${GREEN}✅ Updated BACKEND_URL in .env${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🌐 Backend URL: ${TUNNEL_URL}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$TUNNEL_ONLY" = true ]; then
    echo -e "${GREEN}✅ Tunnel is running. Press Ctrl+C to stop.${NC}"
    echo -e "${BLUE}📊 View tunnel status: http://localhost:4040${NC}"
    echo ""
    # Keep the script running and wait for the tunnel process or Ctrl+C
    wait $NGROK_PID || true
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
