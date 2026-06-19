# PM-PLUS

A multi-agent system that monitors a team's daily check-ins and automatically flags project risks using AI.

## Architecture

```
PM-PLUS/
├── src/          # Python agents (Role 1 — Agent Architect)
└── api/          # TypeScript API server (Role 2 — Data & Orchestrator)
```

---

## Python Agents (`src/`)

Two agents run in parallel:

**Risk Analyzer** — the main brain. When a team member checks in it:
1. Asks the Reporter for that person's history (Loop 1)
2. Sends everything to an LLM to assess risk (overload, blocker, etc.)
3. If overloaded, asks the Resource Balancer who can help (Loop 2)
4. If risk found, posts an alert to the PM room and waits for approval (Loop 3)

**Reporter** — the memory keeper. It:
- Responds to history queries from the Risk Analyzer
- Archives all check-ins and events to the state store
- Generates weekly summary reports on demand

Agents communicate via `@mention` messages through Band rooms (e.g. `@risk_analyzer {...}`).

### Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python src/main.py
```

---

## TypeScript API (`api/`)

Express server acting as the orchestration backbone:
- State management (in-memory session store)
- Band.ai API proxy
- Human-in-the-Loop approval endpoints
- Real-time updates via Server-Sent Events (SSE)
- Swagger UI at `http://localhost:3000/api-docs`

### Setup

```bash
npm install
npm run dev
```

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/human/approval-request` | Create PM approval request |
| POST | `/human/approval-response` | Respond to approval |
| GET | `/state?sessionId=xxx` | Get session state |
| POST | `/state/event` | Record agent event |
| GET | `/updates?sessionId=xxx` | SSE real-time stream |
| GET | `/agent/me` | Band.ai agent profile proxy |

---

## Configuration

Create a `.env` file at the root:

```env
BAND_REST_URL=https://app.band.ai/
BAND_WS_URL=wss://app.band.ai/api/v1/socket/websocket

RISK_ANALYZER_AGENT_ID=your_agent_id
RISK_ANALYZER_API_KEY=your_api_key
REPORTER_API_KEY=your_reporter_key

OPS_ROOM_ID=your_ops_room_id
PM_ALERTS_ROOM_ID=your_pm_alerts_room_id
REPORTS_ROOM_ID=your_reports_room_id

AIML_API_KEY=your_aiml_key
AIML_MODEL=gpt-4o
LLM_PROVIDER=aiml

STATE_STORE_URL=http://localhost:3000
```

## License

MIT
