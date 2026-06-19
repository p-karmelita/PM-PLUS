# PM Plus — Hackathon Submission

---

## Project Title
PM Plus — The AI Project Manager That Never Sleeps

---

## Short Description
PM Plus replaces manual standups with AI agents that track blockers, find who can help, and keep the PM in control — so project managers focus on decisions, not admin.

---

## Long Description

### The Problem
Every project manager's day starts the same way: running a standup, collecting status updates, figuring out who's blocked, deciding who can pick up the slack, and then manually creating and assigning tasks in tools like ClickUp or Jira. By the time all of that is done, half the morning is gone — and it happens again tomorrow.

This is pure admin work. Repetitive, time-consuming, and it scales badly. The larger the team, the more of the PM's day disappears into coordination overhead instead of actual decision-making.

### The Vision
We built PM Plus to be the layer that sits on top of your existing workflow and handles the coordination for you:

- Team members submit their daily check-in through **Slack or a chat room** — no new tools to learn
- AI agents instantly analyze who is overloaded, who is blocked, and who should help
- The right person gets a **ClickUp task assigned automatically** — no copy-pasting, no manual assignment
- When a developer marks work as done, a **testing task is auto-created and assigned** to the QA engineer — the pipeline handoff just happens
- High-severity situations go to the PM for a **one-click approval** before any action is taken
- At the end of the week, a **full team summary is generated automatically** — no human compilation needed

The PM stops being a human message router and starts being what they're actually needed for: making judgment calls on the hard problems.

---

### What We Built at the Hackathon ✅

We built the core AI agent decision engine and a live observability dashboard that runs the full pipeline in real time.

**Three collaborative AI agents over Band.ai:**

- **Risk Analyzer** — reads each team check-in, queries the Reporter for past history, and uses an LLM to assess workload risk. Knows who tends to overload, who's been blocked before, and what severity to assign.
- **Reporter** — maintains a knowledge base of every employee's event history. Answers history queries from the Risk Analyzer instantly. Generates the weekly team summary automatically.
- **Resource Balancer** — when someone is overloaded or blocked, finds the right person on the team to help, based on current workload and availability, with a confidence-scored recommendation.

**Three agent communication loops (all live):**

- **Loop 1 — History**: Risk Analyzer asks Reporter for context before making a risk call
- **Loop 2 — Negotiate**: On overload, Risk Analyzer asks Resource Balancer who can take the task
- **Loop 3 — HITL**: High-severity flags go to the PM dashboard for one-click Approve / Reject before any action is taken

**Live React dashboard:**

- Real-time event stream via Server-Sent Events — no page refresh
- Team health cards with workload indicators per employee
- Agent collaboration graph showing which loop is currently active
- PM approval card with full risk context and a notes field
- Weekly snapshot — one click generates the full week's summary
- Simulated demo mode — runs the full pipeline offline, no API keys needed

---

### What's on the Roadmap 🗺️

These are the integrations we designed and scoped but did not finish building during the hackathon time window:

| Feature | Status |
|---|---|
| Slack / chat input for standup check-ins | Designed — not yet integrated |
| ClickUp task auto-creation and assignment | Designed — not yet integrated |
| Pipeline handoff detection (dev done → QA task auto-created) | Designed — not yet integrated |
| Persistent database (replace in-memory store) | Planned |
| Multi-team auth and workspace isolation | Planned |
| Slack / email notifications on risk flags | Planned |

The agent pipeline, risk decision logic, resource matching, and dashboard are fully functional today. The integrations above are **input/output adapters** — they connect to the same agent pipeline and do not require changes to the core logic.

---

## Technology Tags
Python, Node.js, TypeScript, React, Vite, Express, Band.ai, OpenAI, Server-Sent Events, Pydantic, Swagger, Tailwind CSS

## Category Tags
Productivity, Project Management, Multi-Agent Systems, Human-in-the-Loop, AI Automation, Developer Tools, Future of Work

---

## App Hosting & Code

**GitHub Repository:** https://github.com/fashzd/PM-PLUS

**Hosting Platform:** Railway

**Live Application URL:** https://pm-plus-production.up.railway.app

---

## Cover Image
> Recommended: screenshot of the dashboard showing the Agent Collaboration graph, Team Health cards, and the approval panel.
> Add the PM Plus title and tagline in Canva. Export at 1200x630px.

---

## Video Presentation (2–3 min outline)
1. **(0:00–0:20)** Introduce the team — "We built PM Plus to handle the coordination work that eats a PM's day"
2. **(0:20–0:50)** The problem — standup → blocker identified → find the right person → create task → assign it. Every day. Manually.
3. **(0:50–1:10)** The vision — show the full flow on a slide: Slack check-in → agents analyze → ClickUp task auto-created → PM approves the hard calls. Be clear: "This is where we're going."
4. **(1:10–2:10)** Live demo of what's built today:
   - Open the dashboard at the live URL
   - Click "Trigger Real Pipeline" — show check-ins arriving from the team
   - Show Loop 1 firing — Risk Analyzer queries Reporter for employee history
   - Show a risk/overload detected — Loop 2 fires, Balancer recommends who can help
   - Show the PM approval card appearing for a high-severity flag
   - Approve it — show the response flowing back to the agent
   - Click "Generate Weekly Report" — show the auto-summary
5. **(2:10–2:30)** Close — "The agent brain is live. Slack and ClickUp are the next step — the decision logic is already there."

---

## Slide Deck Outline
1. **Title** — PM Plus · The AI Project Manager That Never Sleeps
2. **The Problem** — PMs spend most of their day on coordination admin. Daily loop: standup → blocker → find person → create task → assign → repeat
3. **The Vision** — full flow diagram: Slack input → agents analyze → ClickUp task assigned → PM approves critical flags only. Label clearly: "Full vision"
4. **What We Built ✅** — the agent decision engine + live dashboard. 3 agents, 3 loops, real-time SSE, HITL approval, weekly summary
5. **The Three Loops** — Loop 1: History · Loop 2: Negotiate · Loop 3: HITL. With a diagram.
6. **Live Dashboard** — screenshot of the real app: agent graph + team health + approval card
7. **Weekly Summary** — automatic report, one click, no human compilation
8. **What's Next 🗺️** — Slack input · ClickUp auto-tasks · pipeline handoffs (dev → QA) · multi-team auth
9. **Tech Stack** — Band.ai · Python · React · Express · OpenAI · SSE
10. **Team** — names and roles (Agent Architect / Data & Orchestrator / Frontend & Observability)
