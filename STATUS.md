# PM-PLUS — Integration Status

## Project Structure (current)

```
PM-PLUS/
├── src/          # Role 1 — Python agents (agent_architect branch)
├── api/          # Role 2 — TypeScript API (main branch)
├── dashboard/    # Role 3 — Frontend (not started)
├── .env
└── agent_config.yaml
```

---

## Role 1 — Python Agents (`src/`) ✅ Built

### What works
- **Risk Analyzer** — Band SDK agent, receives check-ins, runs 3-loop pipeline, calls LLM (GPT-4o)
- **Reporter** — Band SDK agent, answers history queries, archives events, generates reports
- **Loop 1** — Risk → `@reporter {HistoryQuery}` → Reporter → `@risk_analyzer {HistoryResponse}` — genuine back-and-forth through Band ✅
- **Loop 2** — Risk → `@resource_balancer {ResourceRequest}` → wired up but times out (no agent on the other end)
- **LLM integration** — aimlapi.com (GPT-4o), fallback featherless.ai
- **Mock collector** — `src/mock_collector.py` posts 3 fake check-ins (Alice, Bob, Carol)

### What's missing
| # | Issue | Priority |
|---|-------|----------|
| 1 | **Resource Balancer agent** — only 2 agents exist, hackathon requires minimum 3 collaborating through Band | Critical |
| 2 | **Loop 3 is fire-and-forget** — risk flag is posted to PM room but code doesn't wait for `ApprovalResponse` (handler exists in `on_message` but no future is created) | High |

---

## Role 2 — TypeScript API (`api/`) ✅ Built

### What works
- Express server on port 3000
- Band.ai REST API proxy (`/agent/*`, `/me/*`)
- In-memory session state store (`GET /state`, `POST /state/event`)
- Human-in-the-Loop approval endpoints (`POST /human/approval-request`, `POST /human/approval-response`)
- SSE real-time stream (`GET /updates?sessionId=xxx`)
- Swagger UI at `http://localhost:3000/api-docs`

### What's missing
| # | Issue | Priority |
|---|-------|----------|
| 3 | **Missing Reporter endpoints** — Reporter calls `/events`, `/checkins`, `/weekly-snapshot` but none exist in the API | High |
| 4 | **Approval bridge** — when PM calls `POST /human/approval-response`, nothing posts the `ApprovalResponse` back into the Band room so Risk Analyzer's waiting future never resolves | Critical |
| 5 | **Port mismatch fixed** — `.env` updated from `3001` to `3000` ✅ |  |

---

## Role 3 — Frontend Dashboard (`dashboard/`) ❌ Not started

### What needs to be built
| # | Feature | Notes |
|---|---------|-------|
| 6 | Observability dashboard ("PM Vision") | Shows live agent activity |
| 7 | Message log | Consumes SSE from `GET /updates` |
| 8 | PM approval UI | Approve/Reject buttons → calls `POST /human/approval-response` |
| 9 | Mock data generator UI | Trigger button → calls `python src/mock_collector.py` or equivalent endpoint |

---

## Integration Gaps

### Communication flow (current state)

```
mock_collector.py
      │
      │  POST check-in to OPS_ROOM_ID (Band REST)
      ▼
Risk Analyzer (Band SDK)
      │
      │  @reporter {HistoryQuery}          ← Loop 1: works ✅
      ▼
Reporter (Band SDK)
      │
      │  @risk_analyzer {HistoryResponse}  ← Loop 1 reply: works ✅
      ▼
Risk Analyzer
      │
      │  @resource_balancer {ResourceRequest}  ← Loop 2: times out ❌
      │
      │  POST risk flag to PM_ALERTS_ROOM_ID   ← Loop 3: fire-and-forget ❌
      ▼
api/ (TypeScript)
      │
      │  POST /human/approval-response         ← no bridge back to Band ❌
      │  GET  /events (Reporter calls)         ← endpoint missing ❌
      │  POST /events (Reporter calls)         ← endpoint missing ❌
      │  POST /checkins (Reporter calls)       ← endpoint missing ❌
      │  GET  /weekly-snapshot (Reporter)      ← endpoint missing ❌
      ▼
dashboard/ ← not built ❌
```

---

## Hackathon Requirements Check

| Requirement | Status |
|-------------|--------|
| At least 3 agents collaborating through Band | ❌ Only 2 (Resource Balancer missing) |
| Meaningful Band usage (not just a wrapper) | ✅ Loop 1 is genuine bidirectional Band communication |
| Back-and-forth communication (not serial) | ✅ Risk ↔ Reporter use futures + async reply pattern |
| Agents delegate work / hand off tasks | ⚠️ Partial — Loop 2 designed for this but Resource Balancer not built |
| Human-in-the-loop | ⚠️ Partial — approval endpoints exist but bridge is broken |

---

## Priority Build Order

1. **Resource Balancer agent** (`src/agents/balancer.py`) — unlocks 3-agent requirement
2. **Loop 3 fix** — make Risk Analyzer wait for `ApprovalResponse` via future
3. **Approval bridge** in `api/routes/human.ts` — post approval back to Band room
4. **Missing state store endpoints** — `/events`, `/checkins`, `/weekly-snapshot`
5. **Frontend dashboard** — Role 3
