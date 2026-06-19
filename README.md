<div align="center">

# 🛰️ PM PLUS

### Autonomous Multi-Agent Project Intelligence

*An agent workforce that chases status updates, negotiates fixes, and surfaces risks — **before** a human PM ever opens the dashboard.*

[![Hackathon](https://img.shields.io/badge/lablab.ai-Band_of_Agents_Hackathon-7c3aed)](https://lablab.ai/ai-hackathons/band-of-agents-hackathon)
[![Built on Band](https://img.shields.io/badge/Built_on-Band-34d399)](https://band.ai)
[![Python](https://img.shields.io/badge/Agents-Python_3.11-3776ab)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/API-TypeScript_+_Express-3178c6)](https://expressjs.com/)
[![React](https://img.shields.io/badge/Dashboard-React_+_Vite-61dafb)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

</div>

---

> 🏆 **Built for the [Band of Agents Hackathon](https://lablab.ai/ai-hackathons/band-of-agents-hackathon)** (lablab.ai · Jun 12–19, 2026) — a challenge to build enterprise-ready multi-agent systems where **3+ specialized agents collaborate** over **[Band](https://band.ai)**, the universal interaction layer for AI agents.

## 🎯 The Problem

Enterprise PMs spend most of their time **chasing status updates and reallocating resources** — not managing strategy. Systemic risks like persistent bottlenecks are spotted too late to prevent slippage.

## 💡 The Solution

PM PLUS replaces passive dashboards with an **autonomous agent workforce**. Specialized agents negotiate with each other over Band, query shared history, and proactively manage project health — escalating to a human only for high-stakes decisions.

---

## 🤖 The Agent Mesh

Three specialized agents collaborate through **Band rooms** via `@mention` + structured JSON messages — genuine bidirectional handshakes, not a serial chain.

| Agent | Role | What it does |
|-------|------|--------------|
| 🧠 **Risk Analyzer** | *The brain* | Consumes check-ins, scores severity against history, negotiates fixes, escalates to the PM |
| 📚 **Reporter** | *The memory* | RAG-style history queries, archives every event, generates weekly summaries |
| ⚖️ **Resource Balancer** | *The optimizer* | Manages team capacity, proposes reassignments when someone is overloaded |

### Closed-Loop Execution

```mermaid
flowchart LR
    CI([📥 Team check-in]) --> RA[🧠 Risk Analyzer]
    RA <-->|Loop 1 · history| RP[📚 Reporter]
    RA <-->|Loop 2 · negotiate| RB[⚖️ Resource Balancer]
    RA -->|Loop 3 · risk flag| PM[👤 PM Dashboard]
    PM -->|✅ approve / ❌ reject| RA
    RA --> SS[(🗄️ State Store)]
    SS -->|SSE| DASH[🛰️ PM PLUS Dashboard]
```

| # | Loop | Flow |
|---|------|------|
| **1** | History | Risk Analyzer ↔ Reporter — *"Has this blocker persisted?"* shapes the severity score |
| **2** | Negotiation | Risk Analyzer ↔ Resource Balancer — delegates an overload, gets a reassignment proposal |
| **3** | Human-in-the-Loop | Risk Analyzer → PM → back to the agent — flag awaits explicit **Approve / Reject** |

---

## 🏗️ Architecture

```
PM-PLUS/
├── src/          # 🐍 Role 1 — Python agents (Risk Analyzer · Reporter · Resource Balancer)
├── api/          # 🟦 Role 2 — TypeScript orchestration API + SSE + Swagger
└── dashboard/    # ⚛️ Role 3 — React/Vite observability dashboard ("PM PLUS")
```

| Layer | Stack | Responsibility |
|-------|-------|----------------|
| **Agents** | Python · Band SDK · GPT-4o | The negotiating workforce |
| **Orchestrator** | TypeScript · Express | State store, Band proxy, HITL bridge, real-time SSE |
| **Dashboard** | React · Vite · Tailwind | Live observability + PM approval cockpit |

---

## 🌐 Live Demo

The API and dashboard are hosted on Railway:

**➜ https://pm-plus-production.up.railway.app**

> The **"Run Simulated Demo"** button works immediately — no keys, no setup. Click it to see the full 3-loop negotiation stream in real time.

**⚠️ "Trigger Real Pipeline" requires the Python agents running locally** (see below). The agents are not hosted — they connect to Band.ai from your machine and POST events back to the hosted API.

---

## 🚀 Quick Start

### Option 1: One-Command Start (Recommended)

Start the entire system with a single command:

```bash
./start-all.sh
```

This will:
- ✅ Check all prerequisites (Node.js, Python, npm)
- ✅ Install all dependencies (API, Dashboard, Python agents)
- ✅ Start API server on port 3000
- ✅ Start Dashboard on port 5173
- ✅ Start all 3 Python agents (Risk Analyzer, Reporter, Resource Balancer)
- ✅ Create logs in `logs/` directory

**Access Points:**
- 🎨 Dashboard: http://localhost:5173
- 🔌 API: http://localhost:3000
- 📚 Swagger Docs: http://localhost:3000/api-docs

## 📊 Dashboard Features

The PM PLUS dashboard provides a comprehensive interface for monitoring and managing your AI-powered project management system:

### Available Views

1. **Today's Briefing** - Main dashboard with stats, approvals, team health, and agent activity
2. **Risks** - Manage all pending approval requests with approve/reject actions  
3. **Team Health** - Monitor team workload and blockers
4. **Weekly Summary** - View weekly statistics and events
5. **All Events** - Chronological log of all agent communications

### Real-time Updates

The dashboard uses Server-Sent Events (SSE) to provide live updates:
- Agent messages and communications
- Approval requests
- Team health changes
- Project metrics

See [`DASHBOARD_FEATURES.md`](DASHBOARD_FEATURES.md) for detailed documentation.

---

Press `Ctrl+C` to stop all services.

### Option 2: Manual Start (Development)

**1 — Backend (orchestration API)**
```bash
npm install
npm run dev          # ➜ http://localhost:3000   (Swagger at /api-docs)
```

**2 — Dashboard (PM PLUS)**
```bash
cd dashboard
npm install
npm run dev          # ➜ http://localhost:5173
```

**3 — Python Agents**
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python src/main.py   # starts all 3 Band agents
```

**4 — Run the demo** → open **http://localhost:5173**, wait for the status dot to go 🟢 **Connected**, then click **▶ Run Simulated Demo**. Watch the negotiation loop stream in live, risk climb to **HIGH**, and a flag land in the **HITL Decision Panel** — approve it with a note.

### Option 3: Production Build

Build and run the production version:

```bash
./start-production.sh
```

This builds the TypeScript API and React dashboard, then serves everything from a single server on port 3000.

<details>
<summary><b>Run the real agent pipeline against the hosted API</b></summary>

Requires Band/LLM keys (see [Configuration](#-configuration)).

Set `STATE_STORE_URL` in your `.env` to point to the hosted API so agent events appear on the live dashboard:
```bash
STATE_STORE_URL=https://pm-plus-production.up.railway.app
```

Then start the agents locally:
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python src/main.py                       # starts all 3 Band agents
```
Then click **⚡ Trigger Real Pipeline** in the dashboard, or run `python src/mock_collector.py`.
</details>

---

## 🛰️ The Dashboard

The observability cockpit ("PM PLUS") proves the negotiation loop in real time:

- **Live Event Stream** — SSE-connected message log, color-coded by agent and tagged by loop
- **HITL Decision Panel** — Approve / Reject + PM notes, bridged back to the waiting agent
- **Agent Status View** — active / waiting / negotiating health per agent
- **Project Context** — live risk level and project metrics
- **Mock Data Generator** — offline simulation **and** real-pipeline trigger

---

## 🔌 Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/updates?sessionId=xxx` | **SSE** real-time event stream |
| `POST` | `/human/approval-request` | Create a PM approval request |
| `POST` | `/human/approval-response` | Approve/reject → bridges decision back to Band |
| `POST` | `/demo/session` | Create a dashboard session |
| `POST` | `/demo/simulate` | Run the **offline** scripted Loop 1/2/3 demo |
| `POST` | `/demo/trigger-real` | Drive the **real** Band agent pipeline |
| `GET`  | `/state?sessionId=xxx` | Session state snapshot |
| `GET`  | `/agent/me` | Band.ai agent profile proxy |

Full interactive reference: **Swagger UI at `http://localhost:3000/api-docs`**.

### Backbone MVP API (Data & Orchestrator)

Nowy, produkcyjny pion MVP (state + orchestration + HITL) jest dostępny bezpośrednio w API:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/demo/seed-team` | Seed projektu i zespołu (`project-alpha`) |
| `POST` | `/demo/start-daily-checkin` | Start codziennego check-in (`CHECKIN_REQUESTED`) |
| `POST` | `/demo/run-full-scenario` | Full E2E: seed → updates → approvals → weekly report |
| `POST` | `/updates` | Przyjęcie update’u pracownika (Collector → Risk/Balancer/Reporter) |
| `GET`  | `/updates/:projectId` | Lista znormalizowanych update’ów |
| `GET`  | `/agent-messages/:projectId` | Pełny łańcuch message passing między agentami |
| `GET`  | `/decisions/:projectId` | Wszystkie requesty decyzyjne wraz ze statusem lifecycle |
| `GET`  | `/decisions/pending/:projectId` | Oczekujące decyzje PM |
| `POST` | `/decisions` | Zapis decyzji PM (`approve`/`reject`) |
| `POST` | `/decisions/:projectId/:decisionId/apply` | Oznaczenie zatwierdzonej decyzji jako zastosowanej |
| `POST` | `/decisions/:projectId/:decisionId/skip` | Świadome pominięcie zatwierdzonej decyzji |
| `POST` | `/decisions/:projectId/:decisionId/audit` | Audyt decyzji zastosowanej lub pominiętej |
| `POST` | `/pm-chat/messages` | Bezpośredni czat PM z agentem; może tworzyć draft decyzji |
| `GET`  | `/pm-chat/:projectId` | Wątki i wiadomości czatu PM-agent |
| `POST` | `/pm-chat/:projectId/:threadId/confirm` | Zamiana draftu z czatu na formalne approval request |
| `GET`  | `/scheduler/status` | Stan schedulera i ostatnich uruchomień |
| `POST` | `/scheduler/enabled` | Włączenie/wyłączenie automatycznego schedulera |
| `POST` | `/scheduler/run-daily` | Manualne uruchomienie daily check-in |
| `POST` | `/scheduler/run-weekly` | Manualna generacja weekly report |
| `GET`  | `/analytics/:projectId` | Metryki agentów, workload, ryzyka i statusy decyzji |
| `GET`  | `/exports/weekly/:projectId.csv` | Eksport raportu tygodniowego do CSV |
| `GET`  | `/exports/weekly/:projectId.pdf` | Eksport raportu tygodniowego do PDF |
| `GET`  | `/integrations/status` | Status webhooków Slack/Teams |
| `POST` | `/integrations/notify` | Wysłanie digestu/alertu do skonfigurowanych webhooków |
| `GET`  | `/risks/:projectId` | Lista alertów ryzyka |
| `GET`  | `/resource-recommendations/:projectId` | Rekomendacje rebalansowania zasobów |
| `POST` | `/reports/weekly` | Generacja tygodniowego raportu |
| `GET`  | `/reports/weekly/:projectId` | Odczyt ostatniego tygodniowego raportu |
| `GET`  | `/state/:projectId` | Snapshot stanu projektu pod dashboard |

Backbone persistence defaults to `data/backbone-store.json`. Override it with `BACKBONE_STORE_FILE=/path/to/store.json`.
Scheduler configuration can be controlled with `SCHEDULER_ENABLED=true`, `DAILY_CHECKIN_TIME=09:00`, `WEEKLY_REPORT_DAY=friday`, and `WEEKLY_REPORT_TIME=16:00`.
Optional API auth is enabled by setting `API_AUTH_TOKEN`; clients then send `X-API-Key`, `Authorization: Bearer ...`, or `?apiKey=...`.
Slack/Teams notifications use `SLACK_WEBHOOK_URL` and `MS_TEAMS_WEBHOOK_URL`.

---

## ⚙️ Configuration

The offline demo needs **no configuration**. For the real Band pipeline, copy the template and fill in your keys:

```bash
cp .env.example .env
```

`.env.example` documents every variable — Band rooms, the three agent identities, and the LLM provider. See [`.env.example`](./.env.example) for the full, commented list.

---

## ✅ Hackathon Requirements

| Requirement | Status |
|-------------|:------:|
| 3+ specialized agents collaborating through Band | ✅ Risk Analyzer · Reporter · Resource Balancer |
| Band as the active layer (context, handoffs, state) | ✅ All 3 loops use genuine Band messaging |
| Back-and-forth communication (not serial) | ✅ Futures + async reply pattern |
| Agents delegate / hand off tasks | ✅ Loop 2 — Risk delegates to Balancer on overload |
| Human-in-the-loop | ✅ Loop 3 — flag → PM → bridged back to the agent |
| Observability | ✅ Live PM PLUS dashboard |

---

## 🧰 Tech Stack

**Agents:** Python · [Band SDK](https://band.ai) · GPT-4o (aimlapi, featherless fallback) · Pydantic
**Orchestrator:** TypeScript · Express · Server-Sent Events · Swagger
**Dashboard:** React 18 · Vite · Tailwind CSS · EventSource

---

## 📄 License

[MIT](./LICENSE) · Built with 🎵 on [Band](https://band.ai) for the [Band of Agents Hackathon](https://lablab.ai/ai-hackathons/band-of-agents-hackathon).
