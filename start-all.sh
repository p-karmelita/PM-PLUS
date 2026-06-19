#!/bin/bash

# PM PLUS - Complete System Startup Script
# This script starts all components: API, Dashboard, and Python Agents

set -e

echo "🛰️  PM PLUS - Starting Complete System"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please copy .env.example to .env and configure it:"
    echo "  cp .env.example .env"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python $(python3 --version)${NC}"

echo ""
echo -e "${BLUE}📦 Installing dependencies...${NC}"

# Install API dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing API dependencies..."
    npm install
fi

# Install Dashboard dependencies
if [ ! -d "dashboard/node_modules" ]; then
    echo "Installing Dashboard dependencies..."
    cd dashboard && npm install && cd ..
fi

# Setup Python virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment and install dependencies
echo "Installing Python dependencies..."
source .venv/bin/activate
pip install -q -r requirements.txt

echo ""
echo -e "${GREEN}✓ All dependencies installed${NC}"
echo ""

# Create log directory
mkdir -p logs

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down all services...${NC}"
    kill $(jobs -p) 2>/dev/null || true
    wait
    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "${BLUE}🚀 Starting services...${NC}"
echo ""

# Start API Server
echo -e "${BLUE}[1/3] Starting API Server (port ${PORT:-3000})...${NC}"
npm run dev > logs/api.log 2>&1 &
API_PID=$!
sleep 3

# Check if API started successfully
if ! kill -0 $API_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start API server${NC}"
    echo "Check logs/api.log for details"
    exit 1
fi
echo -e "${GREEN}✓ API Server running (PID: $API_PID)${NC}"

# Start Dashboard
echo -e "${BLUE}[2/3] Starting Dashboard (port 5173)...${NC}"
(cd dashboard && npm run dev) > logs/dashboard.log 2>&1 &
DASHBOARD_PID=$!
sleep 3

# Check if Dashboard started successfully
if ! kill -0 $DASHBOARD_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start Dashboard${NC}"
    echo "Check logs/dashboard.log for details"
    kill $API_PID 2>/dev/null || true
    exit 1
fi
echo -e "${GREEN}✓ Dashboard running (PID: $DASHBOARD_PID)${NC}"

# Start Python Agents
echo -e "${BLUE}[3/3] Starting Python Agents...${NC}"
.venv/bin/python3 src/main.py > logs/agents.log 2>&1 &
AGENTS_PID=$!
sleep 2

# Check if Agents started successfully
if ! kill -0 $AGENTS_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start Python Agents${NC}"
    echo "Check logs/agents.log for details"
    kill $API_PID $DASHBOARD_PID 2>/dev/null || true
    exit 1
fi
echo -e "${GREEN}✓ Python Agents running (PID: $AGENTS_PID)${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ PM PLUS is now running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📍 Access Points:${NC}"
echo -e "   Dashboard:  ${GREEN}http://localhost:5173${NC}"
echo -e "   API:        ${GREEN}http://localhost:${PORT:-3000}${NC}"
echo -e "   Swagger:    ${GREEN}http://localhost:${PORT:-3000}/api-docs${NC}"
echo ""
echo -e "${BLUE}📊 Logs:${NC}"
echo -e "   API:        logs/api.log"
echo -e "   Dashboard:  logs/dashboard.log"
echo -e "   Agents:     logs/agents.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all background processes
wait

# Made with Bob
