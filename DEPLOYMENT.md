# 🚀 PM PLUS - Deployment Guide

Complete guide for deploying PM PLUS to production environments.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Railway Deployment](#railway-deployment)
- [Docker Deployment](#docker-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Git**

### Required Accounts & Keys

1. **Band.ai Account** - https://band.ai
   - Create agents for: Risk Analyzer, Reporter, Resource Balancer
   - Get API keys for each agent
   - Create Band rooms (chats) for communication

2. **LLM Provider** (for Python agents)
   - AIML API key (primary) - https://aimlapi.com
   - OR Featherless API key (fallback) - https://featherless.ai

---

## Environment Configuration

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Configure Band.ai Settings

Edit `.env` and fill in your Band.ai credentials:

```bash
# Band.ai Platform
BAND_REST_URL=https://app.band.ai/api/v1
BAND_WS_URL=wss://app.band.ai/api/v1/socket/websocket
BAND_API_KEY=your_user_api_key

# Band Rooms (Chat IDs)
OPS_ROOM_ID=your_ops_room_id
PM_ALERTS_ROOM_ID=your_pm_alerts_room_id
REPORTS_ROOM_ID=your_reports_room_id
```

### 3. Configure Agent Identities

#### Python Agents (src/)

```bash
# Risk Analyzer
RISK_ANALYZER_AGENT_ID=your_risk_analyzer_agent_id
RISK_ANALYZER_API_KEY=your_risk_analyzer_api_key

# Reporter
REPORTER_AGENT_ID=your_reporter_agent_id
REPORTER_API_KEY=your_reporter_api_key

# Resource Balancer
RESOURCE_BALANCER_AGENT_ID=your_resource_balancer_agent_id
RESOURCE_BALANCER_API_KEY=your_resource_balancer_api_key
```

#### TypeScript Agents (api/)

```bash
# Collector Agent
COLLECTOR_AGENT_ID=your_collector_agent_id
COLLECTOR_API_KEY=your_collector_api_key

# Drafter Agent
DRAFTER_AGENT_ID=your_drafter_agent_id
DRAFTER_API_KEY=your_drafter_api_key

# Reviewer Agent
REVIEWER_AGENT_ID=your_reviewer_agent_id
REVIEWER_API_KEY=your_reviewer_api_key
```

### 4. Configure LLM Provider

```bash
# Primary provider
LLM_PROVIDER=aiml
AIML_API_KEY=your_aiml_api_key
AIML_MODEL=gpt-4o

# Fallback provider (optional)
FEATHERLESS_API_KEY=your_featherless_api_key
FEATHERLESS_MODEL=your_model_name
```

### 5. Set State Store URL

For local development:
```bash
STATE_STORE_URL=http://localhost:3000
```

For production (if agents run separately):
```bash
STATE_STORE_URL=https://your-production-domain.com
```

### 6. Optional Production Hardening

```bash
API_AUTH_TOKEN=change_this_long_random_token
BACKBONE_STORE_FILE=./data/backbone-store.json
SCHEDULER_ENABLED=true
DAILY_CHECKIN_TIME=09:00
WEEKLY_REPORT_DAY=friday
WEEKLY_REPORT_TIME=16:00
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
MS_TEAMS_WEBHOOK_URL=https://...
```

When `API_AUTH_TOKEN` is set, API clients must send `X-API-Key`, `Authorization: Bearer ...`, or `?apiKey=...`.

---

## Local Development

### Quick Start (All Services)

```bash
./start-all.sh
```

This starts:
- API server on port 3000
- Dashboard on port 5173
- All Python agents

### Manual Start (Individual Services)

#### Terminal 1: API Server
```bash
npm install
npm run dev
```

#### Terminal 2: Dashboard
```bash
cd dashboard
npm install
npm run dev
```

#### Terminal 3: Python Agents
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python src/main.py
```

### Access Points

- **Dashboard**: http://localhost:5173
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api-docs

---

## Production Deployment

### Build & Start

```bash
./start-production.sh
```

This will:
1. Install all dependencies
2. Build TypeScript API
3. Build React dashboard
4. Start production server (serves both API and dashboard)
5. Start Python agents

### Manual Production Build

```bash
# Install dependencies
npm install --production=false
cd dashboard && npm install && cd ..

# Build
npm run build              # Build API
npm run build:dashboard    # Build Dashboard

# Start
node dist/index.js         # API server (serves dashboard too)
python src/main.py         # Python agents (in separate terminal)
```

### Production Environment Variables

Set `NODE_ENV=production` for optimizations:

```bash
export NODE_ENV=production
```

---

## Railway Deployment

### Prerequisites

1. Install Railway CLI: https://docs.railway.app/develop/cli
2. Login: `railway login`

### Deploy API + Dashboard

```bash
# Link to Railway project
railway link

# Set environment variables
railway variables set PORT=3000
railway variables set NODE_ENV=production
# ... set all other variables from .env

# Deploy
railway up
```

### Deploy Python Agents (Separate Service)

Create a new Railway service for Python agents:

```bash
# Create new service
railway service create pm-plus-agents

# Set environment variables
railway variables set STATE_STORE_URL=https://your-api-url.railway.app
# ... set all Python agent variables

# Deploy
railway up
```

### Railway Configuration Files

The project includes:
- `railway.json` - API/Dashboard service config
- `railway-agents.json` - Python agents service config

---

## Docker Deployment

### Build Docker Images

#### API + Dashboard
```bash
docker build -t pm-plus-api -f Dockerfile.api .
```

#### Python Agents
```bash
docker build -t pm-plus-agents -f Dockerfile.agents .
```

### Run with Docker Compose

```bash
docker-compose up -d
```

### Environment Variables in Docker

Create `.env` file or pass variables:

```bash
docker run -d \
  --env-file .env \
  -p 3000:3000 \
  pm-plus-api
```

---

## Troubleshooting

### API Server Won't Start

**Check logs:**
```bash
cat logs/api.log
```

**Common issues:**
- Port 3000 already in use: Change `PORT` in `.env`
- Missing dependencies: Run `npm install`
- TypeScript errors: Run `npm run build`

### Dashboard Won't Connect

**Check:**
1. API server is running on port 3000
2. CORS is properly configured in `api/index.ts`
3. Vite proxy is configured in `dashboard/vite.config.ts`

**Fix:**
```bash
# Restart both services
./start-all.sh
```

### Python Agents Not Starting

**Check logs:**
```bash
cat logs/agents.log
```

**Common issues:**
- Missing Python dependencies: `pip install -r requirements.txt`
- Invalid API keys: Check `.env` configuration
- STATE_STORE_URL not reachable: Verify API server is running

### Band.ai Connection Issues

**Verify:**
1. API keys are valid and not expired
2. Agent IDs match your Band.ai agents
3. Room IDs are correct
4. Network can reach `app.band.ai`

**Test connection:**
```bash
curl -H "X-API-Key: your_api_key" https://app.band.ai/api/v1/agent/me
```

### SSE (Server-Sent Events) Not Working

**Check:**
1. Browser supports EventSource
2. No proxy/firewall blocking SSE
3. API server CORS headers allow SSE

**Test:**
```bash
curl -N http://localhost:3000/updates?sessionId=test
```

### Production Build Fails

**Common issues:**
- TypeScript errors: Fix type issues in code
- Missing dependencies: Run `npm install --production=false`
- Out of memory: Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`

---

## Monitoring & Logs

### Log Files

All logs are stored in `logs/` directory:

- `logs/api.log` - API server logs
- `logs/dashboard.log` - Dashboard dev server logs
- `logs/agents.log` - Python agents logs
- `logs/api-prod.log` - Production API logs
- `logs/agents-prod.log` - Production agents logs

### View Logs in Real-Time

```bash
# API logs
tail -f logs/api.log

# Agent logs
tail -f logs/agents.log

# All logs
tail -f logs/*.log
```

### Health Checks

```bash
# API health
curl http://localhost:3000/health

# Agent status (via API)
curl http://localhost:3000/state?sessionId=your_session_id
```

---

## Security Considerations

### Production Checklist

- [ ] All API keys stored in environment variables (not in code)
- [ ] `.env` file added to `.gitignore`
- [ ] CORS configured for specific origins only
- [ ] HTTPS enabled (use reverse proxy like nginx)
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Logs don't contain sensitive data
- [ ] Regular dependency updates (`npm audit`, `pip check`)

### Recommended Security Headers

Add to your reverse proxy (nginx/Apache):

```nginx
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
```

---

## Performance Optimization

### Production Optimizations

1. **Enable compression** (gzip/brotli)
2. **Use CDN** for static assets
3. **Enable caching** for API responses
4. **Use connection pooling** for database
5. **Monitor memory usage** and set limits

### Scaling

- **Horizontal scaling**: Run multiple API instances behind load balancer
- **Agent scaling**: Run agents on separate machines
- **Database**: Use external database for state store (Redis/PostgreSQL)

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-repo/pm-plus/issues
- Documentation: See README.md
- Band.ai Docs: https://docs.band.ai

---

**Built with 🎵 on [Band](https://band.ai) for the [Band of Agents Hackathon](https://lablab.ai/ai-hackathons/band-of-agents-hackathon)**
