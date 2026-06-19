# PM-PLUS — Integration Status

## Project Structure (current)

```
PM-PLUS/
├── src/          # Role 1 — Python agents (Risk Analyzer, Reporter, Resource Balancer)
├── api/          # Role 2 — TypeScript orchestration API + SSE
├── dashboard/    # Role 3 — React/Vite observability dashboard ✅ Built
├── .env          # (see .env.example)
└── agent_config.yaml
```

---

## Role 1 — Python Agents (`src/`) ✅ Built

### What works
- **Risk Analyzer** — Band SDK agent, receives check-ins, runs 3-loop pipeline, calls LLM (GPT-4o)
- **Reporter** — Band SDK agent, answers history queries, archives events, generates reports
- **Resource Balancer** — Band SDK agent, handles `ResourceRequest`, proposes reassignments ✅
- **Loop 1** — Risk → `@reporter {HistoryQuery}` → Reporter → `@risk_analyzer {HistoryResponse}` — genuine back-and-forth through Band ✅
- **Loop 2** — Risk → `@resource_balancer {ResourceRequest}` → Balancer replies — works now that the agent exists ✅
- **Loop 3** — Risk posts flag to PM room and **awaits** `ApprovalResponse` via a future (no longer fire-and-forget) ✅
- **LLM integration** — aimlapi.com (GPT-4o), fallback featherless.ai
- **Mock collector** — `src/mock_collector.py` posts 3 fake check-ins (Alice, Bob, Carol)

### Known issue (non-blocking)
- LLM occasionally echoes `flag_id: "f-001"` from the prompt example instead of a unique id — fix post-hackathon.

---

## Role 2 — TypeScript API (`api/`) ✅ Built

### What works
- Express server on port 3000 + Swagger UI at `/api-docs`
- Band.ai REST API proxy (`/agent/*`, `/me/*`)
- In-memory session state store (`GET /state`, `POST /state/event`)
- Human-in-the-Loop approval endpoints (`POST /human/approval-request`, `POST /human/approval-response`)
- **Approval bridge** — `POST /human/approval-response` posts `@risk_analyzer {ApprovalResponse}` back to the Band OPS room, resolving Loop 3 ✅
- **Reporter state-store endpoints** — `GET /events`, `POST /events`, `POST /checkins`, `GET /weekly-snapshot` ✅
- Collector + Resource Balancer routes (`/collector/*`, `/resource-balancer/*`)
- SSE real-time stream (`GET /updates?sessionId=xxx`)
- **Demo driver endpoints** (`api/routes/demo.ts`) — `POST /demo/session`, `POST /demo/simulate` (offline scripted loop), `POST /demo/trigger-real` (drives the real Band pipeline) ✅

---

## Role 3 — Frontend Dashboard (`dashboard/`) ✅ Built

React + Vite + TypeScript + Tailwind. Connects to the API via the existing SSE stream
(Vite dev-proxies API routes to `:3000`, so no CORS changes were needed).

| # | Feature | File | Status |
|---|---------|------|--------|
| 6 | Observability dashboard ("PM PLUS") | `src/App.tsx` | ✅ |
| 7 | Live Message Log — SSE from `GET /updates`, color-coded by agent, loop-tagged | `src/components/StreamLogger.tsx`, `src/hooks/useEventStream.ts` | ✅ |
| 8 | PM approval UI — Approve/Reject + PM notes → `POST /human/approval-response` | `src/components/DecisionPanel.tsx` | ✅ |
| 9 | Mock Data Generator — "Run Simulated Demo" (offline) + "Trigger Real Pipeline" (Band) | `src/components/MockDataGenerator.tsx` | ✅ |
| — | Agent Status View + Project Context (risk/metrics) | `src/components/AgentStatusView.tsx`, `ProjectContextViewer.tsx` | ✅ |

### Run it
```bash
npm run dev                                   # backend (Express) on :3000
cd dashboard && npm install && npm run dev    # dashboard (Vite) on :5173
```
Open http://localhost:5173 → status goes **Connected** → click **▶ Run Simulated Demo**
to stream the full Loop 1/2/3 closed loop and approve the resulting risk flag. The offline
simulation needs no Band/LLM keys.

---

## Communication flow (current state)

```
Mock Data Generator (dashboard)
   ├── ▶ Simulated  → POST /demo/simulate  → scripted events into StateStore (offline)
   └── ⚡ Real       → POST /demo/trigger-real → check-ins to Band OPS room
                                                       │
mock_collector.py ─── POST check-in to OPS_ROOM_ID ───┘
      ▼
Risk Analyzer (Band SDK)
      │  @reporter {HistoryQuery} → Reporter → @risk_analyzer {HistoryResponse}   ← Loop 1 ✅
      │  @resource_balancer {ResourceRequest} → Balancer reply                     ← Loop 2 ✅
      │  POST risk flag to PM_ALERTS_ROOM_ID, await ApprovalResponse               ← Loop 3 ✅
      ▼
api/ (TypeScript)
      │  POST /human/approval-response → bridges @risk_analyzer {ApprovalResponse} ✅
      │  /events, /checkins, /weekly-snapshot (Reporter)                           ✅
      │  GET /updates (SSE)  ───────────────────────────────────────────────┐
      ▼                                                                       ▼
StateStore  ──── emits UpdateEvent ───────────────────────────────────►  dashboard/ ✅
```

---

## Hackathon Requirements Check

| Requirement | Status |
|-------------|--------|
| At least 3 agents collaborating through Band | ✅ Risk Analyzer, Reporter, Resource Balancer |
| Meaningful Band usage (not just a wrapper) | ✅ All 3 loops use genuine Band bidirectional messaging |
| Back-and-forth communication (not serial) | ✅ Futures + async reply pattern |
| Agents delegate work / hand off tasks | ✅ Loop 2: Risk delegates to Balancer on overload |
| Human-in-the-loop | ✅ Loop 3: flag posted to PM room, approval bridges back to agent |
| Observability dashboard | ✅ Role 3 dashboard (live stream + HITL + mock generator) |

---

## Remaining / nice-to-have
- Replace the `on_event()` print stub in `src/main.py` with a POST to `/state/event` so the **real**
  agent pipeline (not just the simulation) surfaces every event in the dashboard stream.
- Fix the `flag_id` uniqueness issue noted under Role 1.
