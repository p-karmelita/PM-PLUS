# 🔗 PM PLUS - System Integration Guide

Complete guide explaining how all components of PM PLUS work together.

## 📋 Table of Contents

- [System Architecture](#system-architecture)
- [Component Communication](#component-communication)
- [Data Flow](#data-flow)
- [API Integration](#api-integration)
- [Agent Integration](#agent-integration)
- [Frontend Integration](#frontend-integration)
- [Event Streaming](#event-streaming)

---

## System Architecture

PM PLUS consists of three main layers that work together:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Dashboard)                      │
│                  React + Vite (Port 5173)                    │
│              Real-time SSE + REST API calls                  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/SSE
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Orchestrator)                      │
│            TypeScript + Express (Port 3000)                  │
│         State Store + SSE Hub + Band.ai Proxy                │
└────────────┬───────────────────────────────┬────────────────┘
             │ HTTP                          │ Band.ai API
             ↓                               ↓
┌────────────────────────┐    ┌─────────────────────────────┐
│   Python Agents        │    │      Band.ai Platform       │
│  - Risk Analyzer       │←───│   WebSocket + REST API      │
│  - Reporter            │    │   Agent Communication       │
│  - Resource Balancer   │    └─────────────────────────────┘
└────────────────────────┘
```

---

## Component Communication

### 1. Frontend ↔ Backend API

**Protocol:** HTTP REST + Server-Sent Events (SSE)

**Endpoints Used:**
- `GET /updates?sessionId=xxx` - SSE stream for real-time updates
- `POST /demo/session` - Create new session
- `POST /demo/simulate` - Run simulated demo
- `POST /demo/trigger-real` - Trigger real agent pipeline
- `POST /human/approval-response` - Submit PM decisions
- `GET /state?sessionId=xxx` - Get session state
- `GET /weekly-snapshot` - Get weekly report data

**Configuration:**
- Development: Vite proxy forwards requests to `http://localhost:3000`
- Production: API serves built dashboard from `/dashboard/dist`

### 2. Backend API ↔ Python Agents

**Protocol:** HTTP REST

**Flow:**
1. Python agents POST events to API: `POST /events/agent`
2. API stores events in state store
3. API broadcasts events via SSE to connected dashboards

**Configuration:**
- Agents use `STATE_STORE_URL` environment variable
- Default: `http://localhost:3000`
- Production: Set to your deployed API URL

### 3. Python Agents ↔ Band.ai

**Protocol:** WebSocket + REST API

**Communication:**
- Agents connect to Band.ai via WebSocket for real-time messaging
- Agents use REST API for context retrieval and activity reporting
- All agent-to-agent communication goes through Band.ai rooms

**Configuration:**
- `BAND_REST_URL`: https://app.band.ai/api/v1
- `BAND_WS_URL`: wss://app.band.ai/api/v1/socket/websocket
- Each agent has unique `AGENT_ID` and `API_KEY`

---

## Data Flow

### Complete Request Flow

```
1. User Action (Dashboard)
   ↓
2. HTTP Request to API
   ↓
3. API processes request
   ↓
4. API triggers agents (if needed)
   ↓
5. Agents communicate via Band.ai
   ↓
6. Agents POST results to API
   ↓
7. API updates state store
   ↓
8. API broadcasts via SSE
   ↓
9. Dashboard receives update
   ↓
10. UI updates in real-time
```

### Example: Risk Analysis Flow

```
1. Check-in submitted
   ↓
2. Risk Analyzer receives check-in (Band.ai)
   ↓
3. Risk Analyzer queries Reporter for history
   ├─→ Reporter queries state store
   └─→ Reporter responds with history
   ↓
4. Risk Analyzer analyzes risk
   ↓
5. If high risk: Risk Analyzer queries Resource Balancer
   ├─→ Balancer analyzes resources
   └─→ Balancer responds with recommendation
   ↓
6. Risk Analyzer creates flag
   ↓
7. Flag posted to API (/events/agent)
   ↓
8. API creates approval request
   ↓
9. Dashboard receives via SSE
   ↓
10. PM approves/rejects
   ↓
11. Decision sent to API
   ↓
12. API bridges decision back to Band.ai
   ↓
13. Risk Analyzer receives decision
   ↓
14. Process complete
```

---

## API Integration

### State Store

The API maintains a centralized state store that tracks:

- **Sessions**: Active dashboard sessions
- **Events**: All agent events and activities
- **Check-ins**: Team member status updates
- **Approvals**: Pending PM decisions
- **Metrics**: Project health metrics

**Implementation:** [`api/store.ts`](api/store.ts)

### SSE (Server-Sent Events)

Real-time updates are pushed to the dashboard via SSE:

```typescript
// Dashboard subscribes to updates
const eventSource = new EventSource('/updates?sessionId=xxx');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle update
};
```

**Event Types:**
- `agent_message` - Agent communication
- `approval_request` - New PM decision needed
- `approval_response` - PM decision made
- `state_update` - State change
- `metrics_update` - Metrics changed

### Band.ai Proxy

The API acts as a proxy for Band.ai operations:

**Services:**
- [`api/services/bandai.service.ts`](api/services/bandai.service.ts) - Band.ai API wrapper
- [`api/services/orchestrator.service.ts`](api/services/orchestrator.service.ts) - Workflow coordination

**Features:**
- Agent profile retrieval
- Chat context rehydration
- Activity reporting
- Message sending

---

## Agent Integration

### Agent Configuration

Agents are configured via environment variables or `agent_config.yaml`:

```python
# src/config.py
from src.config import get_config

config = get_config()
risk_config = config.get_agent_config('risk_analyzer')
```

### Agent Lifecycle

```python
# src/main.py
async def main():
    await asyncio.gather(
        start_risk_analyzer(on_event=on_event),
        start_reporter(on_event=on_event),
        start_resource_balancer(on_event=on_event),
    )
```

Each agent:
1. Connects to Band.ai WebSocket
2. Listens for messages in assigned rooms
3. Processes messages based on type
4. Sends responses via Band.ai
5. Posts events to API state store

### Message Routing

Agents use a message router to handle different message types:

```python
# src/core/router.py
class MessageRouter:
    @staticmethod
    def parse_payload(content: str):
        # Parse JSON payload from message
        
    async def send_message(self, payload, mentions):
        # Send message via Band.ai
```

### LLM Integration

Agents use LLM for intelligent decision-making:

```python
# src/core/llm.py
async def call_llm(system_prompt: str, user_prompt: str):
    # Call configured LLM provider (AIML or Featherless)
```

---

## Frontend Integration

### React Components

**Main Components:**
- `App.tsx` - Main application shell
- `Sidebar.tsx` - Navigation and approval queue
- `StatCards.tsx` - Key metrics display
- `AgentGraph.tsx` - Agent activity visualization
- `TeamHealthGrid.tsx` - Team member status
- `DecisionPanel.tsx` - PM approval interface

### State Management

The dashboard uses React hooks for state:

```typescript
// Custom hook for SSE connection
const { status, log, approvals, agents, metrics } = 
  useEventStream(sessionId);
```

### API Client

```typescript
// dashboard/src/api.ts
export async function createSession(): Promise<{ sessionId: string }>;
export async function runSimulation(sessionId: string);
export async function triggerReal(sessionId: string);
export async function respondApproval(decision: ApprovalDecision);
```

---

## Event Streaming

### SSE Implementation

**Server Side (API):**

```typescript
// api/routes/updates.ts
app.get('/updates', (req, res) => {
  const sessionId = req.query.sessionId;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Register client
  stateStore.addSSEClient(sessionId, res);
  
  // Send initial state
  res.write(`data: ${JSON.stringify(initialState)}\n\n`);
  
  // Cleanup on disconnect
  req.on('close', () => {
    stateStore.removeSSEClient(sessionId, res);
  });
});
```

**Client Side (Dashboard):**

```typescript
// dashboard/src/hooks/useEventStream.ts
const eventSource = new EventSource(`/updates?sessionId=${sessionId}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleUpdate(data);
};

eventSource.onerror = () => {
  // Reconnect logic
};
```

### Event Broadcasting

When agents post events:

```typescript
// api/store.ts
broadcastToSession(sessionId: string, event: any) {
  const clients = this.sseClients.get(sessionId) || [];
  const message = `data: ${JSON.stringify(event)}\n\n`;
  
  clients.forEach(client => {
    client.write(message);
  });
}
```

---

## Integration Checklist

### Development Setup

- [ ] All dependencies installed (`npm install`, `pip install -r requirements.txt`)
- [ ] `.env` file configured with all required variables
- [ ] Band.ai agents created and API keys obtained
- [ ] LLM provider API key configured
- [ ] All three services running (API, Dashboard, Agents)

### Production Setup

- [ ] Environment variables set in production environment
- [ ] CORS configured for production domain
- [ ] `STATE_STORE_URL` points to production API
- [ ] HTTPS enabled (via reverse proxy)
- [ ] Health checks configured
- [ ] Logging and monitoring enabled
- [ ] Backup strategy for state store

### Testing Integration

```bash
# 1. Start all services
./start-all.sh

# 2. Open dashboard
open http://localhost:5173

# 3. Check connection status (should be green)

# 4. Run simulated demo
# Click "Run Simulated Demo" button

# 5. Verify:
# - Events appear in stream
# - Agents show activity
# - Metrics update
# - Approval requests appear

# 6. Test real pipeline (if configured)
# Click "Trigger Real Pipeline" button
```

---

## Troubleshooting Integration Issues

### Dashboard Not Connecting

**Symptoms:** Red connection dot, no events

**Check:**
1. API server is running on port 3000
2. Vite proxy is configured correctly
3. No CORS errors in browser console
4. SSE endpoint is accessible: `curl -N http://localhost:3000/updates?sessionId=test`

### Agents Not Communicating

**Symptoms:** No agent activity, events not appearing

**Check:**
1. Python agents are running (`ps aux | grep python`)
2. Agent logs show connection to Band.ai
3. `STATE_STORE_URL` is correct in agent environment
4. API is receiving events: `tail -f logs/api.log`

### Events Not Appearing in Dashboard

**Symptoms:** Agents running but dashboard not updating

**Check:**
1. SSE connection is active (check Network tab)
2. Session ID matches between dashboard and agents
3. API is broadcasting events: check `api/store.ts` logs
4. No errors in browser console

### Band.ai Connection Issues

**Symptoms:** Agents can't connect to Band.ai

**Check:**
1. API keys are valid and not expired
2. Agent IDs are correct
3. Network can reach `app.band.ai`
4. WebSocket connection is not blocked by firewall

---

## Performance Considerations

### Scaling

- **API**: Can run multiple instances behind load balancer
- **Agents**: Can run on separate machines, all connect to same Band.ai rooms
- **Dashboard**: Static files can be served from CDN

### Optimization

- Enable gzip compression for API responses
- Use Redis for state store in production
- Implement connection pooling for database
- Cache static assets with long TTL
- Use WebSocket instead of SSE for better performance

---

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Rotate API keys regularly** - Especially in production
3. **Use HTTPS in production** - Configure reverse proxy (nginx/Apache)
4. **Validate all inputs** - Both API and agent sides
5. **Rate limit API endpoints** - Prevent abuse
6. **Monitor for anomalies** - Set up alerts for unusual activity
7. **Keep dependencies updated** - Run `npm audit` and `pip check` regularly

---

## Additional Resources

- [Band.ai Documentation](https://docs.band.ai)
- [Express.js SSE Guide](https://expressjs.com/en/guide/using-middleware.html)
- [React EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Python asyncio](https://docs.python.org/3/library/asyncio.html)

---

**Built with 🎵 on [Band](https://band.ai) for the [Band of Agents Hackathon](https://lablab.ai/ai-hackathons/band-of-agents-hackathon)**