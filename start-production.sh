#!/bin/bash

# PM PLUS - Production Startup Script
# This script builds and starts the production version

set -e

echo "🛰️  PM PLUS - Production Build & Start"
echo "========================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please copy .env.example to .env and configure it:"
    echo "  cp .env.example .env"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)
export NODE_ENV=production

echo -e "${BLUE}📦 Installing dependencies...${NC}"

# Install dependencies
npm install --production=false
cd dashboard && npm install && cd ..

echo -e "${BLUE}🔨 Building application...${NC}"

# Build TypeScript API
npm run build

# Build React Dashboard
npm run build:dashboard

echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Setup Python environment
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

# Create log directory
mkdir -p logs

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down...${NC}"
    kill $(jobs -p) 2>/dev/null || true
    wait
    echo -e "${GREEN}✓ Stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "${BLUE}🚀 Starting production services...${NC}"
echo ""

# Start API Server (serves both API and built dashboard)
echo -e "${BLUE}[1/2] Starting API Server (port ${PORT:-3000})...${NC}"
node dist/index.js > logs/api-prod.log 2>&1 &
API_PID=$!
sleep 3

if ! kill -0 $API_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start API server${NC}"
    echo "Check logs/api-prod.log for details"
    exit 1
fi
echo -e "${GREEN}✓ API Server running (PID: $API_PID)${NC}"

# Start Python Agents
echo -e "${BLUE}[2/2] Starting Python Agents...${NC}"
.venv/bin/python3 src/main.py > logs/agents-prod.log 2>&1 &
AGENTS_PID=$!
sleep 2

if ! kill -0 $AGENTS_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start Python Agents${NC}"
    echo "Check logs/agents-prod.log for details"
    kill $API_PID 2>/dev/null || true
    exit 1
fi
echo -e "${GREEN}✓ Python Agents running (PID: $AGENTS_PID)${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ PM PLUS Production is running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📍 Access:${NC}"
echo -e "   Application: ${GREEN}http://localhost:${PORT:-3000}${NC}"
echo -e "   API Docs:    ${GREEN}http://localhost:${PORT:-3000}/api-docs${NC}"
echo ""
echo -e "${BLUE}📊 Logs:${NC}"
echo -e "   API:    logs/api-prod.log"
echo -e "   Agents: logs/agents-prod.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

wait

# Made with Bob
