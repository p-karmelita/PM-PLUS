# PM-PLUS — Implementation Status

## Current State (as of June 2026)

All Role 1, Role 2, and Role 3 work is complete. The app runs locally with 3 terminals.

---

## Local Dev — How to Run

| Terminal | Command | What it does |
|---|---|---|
| 1 | `npm run dev` | Express API on :3000 |
| 2 | `cd dashboard && npm run dev` | Vite dev server on :5173 (open in browser) |
| 3 | `python src/main.py` | 3 Python agents connecting to Band |

Optional: `python src/mock_collector.py` — fires fake check-ins to Band without using the dashboard button.

---

## Role 1 — Agent Architect ✅

- Risk Analyzer agent (`src/agents/risk.py`) — 3-loop pipeline, Band SDK
- Reporter agent (`src/agents/reporter.py`) — history queries, event archiving, reports
- Resource Balancer agent (`src/agents/balancer.py`) — handles ResourceRequest, calls LLM, returns ResourceResponse
- Resource Balancer prompt (`src/agents/balancer_prompts.py`)
- All 3 agents registered in `src/main.py` and running via `asyncio.gather()`
- Loop 1 — Risk ↔ Reporter bidirectional communication (verified working)
- Loop 2 — Risk ↔ Balancer (wired up, triggers on `risk_type == "overload"`)
- Loop 3 — Risk posts flag to PM room, awaits ApprovalResponse via future
- MessageRouter (`src/core/router.py`) — @mention + JSON payload parsing
- Pydantic message types (`src/core/types.py`) — all message types defined
- LLM client (`src/core/llm.py`) — aimlapi.com GPT-4o + featherless fallback
- Mock collector (`src/mock_collector.py`) — posts Alice / Bob / Carol / Dave check-ins
- Band agent config (`agent_config.yaml`) — all 3 agents have valid IDs and API keys

### Resolved issue
- No active known issue in the local deterministic flow. Risk Analyzer overwrites LLM-provided `flag_id` with a local UUID before posting PM alerts.

---

## Role 2 — Data & Orchestrator ✅

- Express server on port 3000 + Swagger UI at `/api-docs`
- Band.ai REST proxy (`/agent/*`, `/me/*`)
- In-memory StateStore — sessions, resources, allocations, metrics
- SSE real-time stream (`GET /updates?sessionId=xxx`)
- Human-in-loop endpoints — `POST /human/approval-request`, `POST /human/approval-response`
- Approval bridge — `POST /human/approval-response` POSTs `@risk_analyzer {ApprovalResponse}` back to Band OPS room, resolving Loop 3
- Collector routes — `/collector/check-in`, `/data`, `/data/:id/process`
- Resource Balancer routes — `/resource-balancer/resources`, `/allocations`, `/recommendations`, `/metrics`
- Reporter state-store endpoints (`api/routes/reporter.ts`) — `GET /events`, `POST /events`, `POST /checkins`, `GET /weekly-snapshot`
- OrchestratorService — coordinates collector → balancer workflow
- `POST /events/agent` (`api/routes/events.ts`) — receives Python `on_event()` calls, derives SSE messages, broadcasts to all active sessions; also creates HITL approval card when `risk_flag_posted`

---

## Role 3 — Frontend & Observability ✅

- React + Vite dashboard (`dashboard/`) — fully built
- `StreamLogger` — live color-coded event feed, auto-scroll, loop tags
- `AgentStatusView` — active / negotiating / waiting dots for all 4 agents
- `ProjectContextViewer` — risk level badge + project metrics
- `DecisionPanel` — Approve / Reject + PM notes, bridged back to Band via `/human/approval-response`
- `MockDataGenerator` — "Run Simulated Demo" (offline) + "Trigger Real Pipeline" (Band) buttons
- `WeeklyReport` — "↻ Generate" button hits `GET /weekly-snapshot`, renders 7-day summary panel
- `useEventStream` hook — SSE connection, handles all 5 event types
- Simulated demo (`POST /demo/simulate`) works end-to-end in the browser with no keys
- Real mode: `on_event()` in `src/main.py` fires `httpx.post()` to `/events/agent` → SSE → dashboard (Reporter and Balancer show as active)

---

## Hackathon Requirements Check

| Requirement | Status |
|---|---|
| At least 3 agents collaborating through Band | ✅ Risk Analyzer, Reporter, Resource Balancer all running |
| Meaningful Band usage (not just a wrapper) | ✅ All 3 loops use genuine Band bidirectional messaging |
| Back-and-forth agent communication | ✅ All loops use futures + async reply pattern |
| Agents delegate work / hand off tasks | ✅ Loop 2: Risk delegates to Balancer on overload |
| Human-in-the-loop | ✅ Loop 3: flag posted to PM room, approval bridges back to agent |
| Observability dashboard | ✅ Live PM PLUS dashboard — simulated + real mode both working |

---

## 🚀 MVP Hosting — Deployment Runbook

### 1. ⚡ Build the frontend ✅ DONE
```sh
npm run build:all
```
Compiles React app into `dashboard/dist` and TypeScript API into `dist/`. Run again after any code changes before deploying.

### 2. 🌐 Deploy to Railway

Railway is a cloud hosting platform. It reads your config files, builds the app, and gives you a public URL. Free tier ($5 credit/month) is enough for a hackathon demo.

**Step 1 — Push code to GitHub** ✅ DONE
Branch `feature/mvp-hosting` is pushed. Merge to `main` before deploying.

**Step 2 — Create Railway account**
- Go to railway.app → sign up with GitHub

**Step 3 — Deploy Service 1 (API + Dashboard)**
- New Project → "Deploy from GitHub repo" → select this repo
- Railway auto-detects `railway.json` → builds with `npm run build:all` → starts with `npm start`
- Go to service Settings → Variables → add every key from `.env.example` with real values (Band keys, LLM keys, room IDs)
- Go to Settings → Networking → "Generate Domain" to get your public URL
- Copy that URL (e.g. `https://pm-plus-abc123.up.railway.app`) — you'll need it for Service 2

**Step 4 — Deploy Service 2 (Python Agents)**
- In the same Railway project → "Add Service" → "GitHub Repo" → same repo
- In the new service → Settings → "Config File Path" → set to `railway-agents.json`
- Add all the same env vars as Service 1, PLUS one extra:
  - `STATE_STORE_URL=https://pm-plus-abc123.up.railway.app` ← your URL from Step 3
- Railway runs `pip install -r requirements.txt` then `python src/main.py`

**Step 5 — Verify**
- Open your public URL in the browser → dashboard loads
- Click "Run Simulated Demo" → stream lights up (no keys needed)
- Click "Trigger Real Pipeline" → Python agents process live Band check-ins

**Critical:** `STATE_STORE_URL` in Service 2 must point to the live Service 1 URL. This is what makes real agent activity show up on the dashboard — Python agents POST events to Express, which broadcasts them over SSE.

---

## Implemented Follow-up Scope

- `flag_id` uniqueness is enforced in `src/agents/risk.py`.
- Backbone persistence is available through `BACKBONE_STORE_FILE` and defaults to `data/backbone-store.json`.
- Optional API auth is available through `API_AUTH_TOKEN`.
- Real Python agent events are posted to `/events/agent` from `src/main.py`.
