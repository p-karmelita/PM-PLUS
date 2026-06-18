# PM-PLUS API

Agent orchestration API with Band.ai integration for multi-agent project management system.

## Architecture Overview

This API serves as the **Data & Orchestrator** (Backbone) component, responsible for:
- **State management and storage** - Centralized StateStore for session, resource, and data management
- **Band.ai API integration and proxy** - Seamless communication with Band.ai agents
- **Collector Agent integration** - Data collection from multiple sources (check-ins, status reports, risks, blockers)
- **Resource Balancer Agent integration** - Resource allocation, load balancing, and capacity management
- **Human-in-the-Loop approval workflows** - PM approval for critical decisions
- **Real-time updates via Server-Sent Events (SSE)** - Live updates for all stakeholders
- **Agent orchestration** - Coordinated workflows between multiple agents

## Prerequisites

- Node.js 18+
- npm or yarn
- Band.ai API key

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory (see `.env.example` for reference):

```env
# Server Configuration
PORT=3000

# Band.ai API Configuration
BAND_API_KEY=your_default_band_api_key_here

# Collector Agent Configuration
COLLECTOR_AGENT_ID=24437a9a-161b-4719-a1d3-1127969c355d
COLLECTOR_API_KEY=band_a_1781716221_LBcemt1vSVsaQn0z7fimLIOl-N6v2oCb

# Resource Balancer Agent Configuration
RESOURCE_BALANCER_AGENT_ID=0bcdb5ba-79b1-4072-87c4-3df8538e58b3
RESOURCE_BALANCER_API_KEY=band_a_1781715758_sfJgn-If3YswFk6PML3xd-4rXxH5XS-S

# Drafter Agent Configuration
DRAFTER_AGENT_ID=38b68b35-411e-4920-911d-426c4613765b
DRAFTER_API_KEY=band_a_1781453829_yv5dXz37gUWUF4RekvezT7nayxBCYDxE

# Reviewer Agent Configuration
REVIEWER_AGENT_ID=3f93702f-f803-45b9-a36a-694c0328a8c9
REVIEWER_API_KEY=band_a_1781456574__cXtAW4JfRyl-fXJQP2M9_4vk2J030xt
```

## Running the Server

### Development mode (with auto-reload)
```bash
npm run dev
```

### Production mode
```bash
npm run build
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## 📚 Interactive API Documentation

Once the server is running, you can access the interactive Swagger UI documentation:

**Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

The Swagger UI provides:
- **Interactive API explorer** - Test all endpoints directly from your browser
- **Automatic API key authentication** - Enter your Band.ai API key once and it persists across requests
- **Request/response examples** - See example payloads for all endpoints
- **Schema documentation** - Detailed information about all data models

### Using the Swagger UI

1. Open [http://localhost:3000/api-docs](http://localhost:3000/api-docs) in your browser
2. Click the **"Authorize"** button at the top right
3. Enter your Band.ai API key in the `X-API-Key` field
4. Click **"Authorize"** and then **"Close"**
5. All subsequent requests will automatically include your API key

You can also download the OpenAPI specification as JSON:
**OpenAPI Spec**: [http://localhost:3000/api-docs.json](http://localhost:3000/api-docs.json)

## API Endpoints

### Agent API (Band.ai Proxy)

#### Get Current Agent Profile
```bash
GET /agent/me
Headers: X-API-Key: <apiKey>
```

Fetches the current agent's profile from Band.ai.

**Example:**
```bash
curl -X GET http://localhost:3000/agent/me \
  -H "X-API-Key: your_api_key"
```

---

#### Get Agent Context
```bash
GET /agent/chats/:chatId/context?limit=50&page=1&page_size=50
Headers: X-API-Key: <apiKey>
```

Retrieves agent context for rehydration from a specific chat.

**Parameters:**
- `chatId` (path) - Chat room ID
- `limit` (query) - Number of items to return (default: 50)
- `page` (query) - Page number (default: 1)
- `page_size` (query) - Items per page (default: 50)

**Example:**
```bash
curl -X GET "http://localhost:3000/agent/chats/chat_123/context?limit=50" \
  -H "X-API-Key: your_api_key"
```

---

#### Report Agent Activity
```bash
POST /agent/chats/:chatId/activity
Headers: X-API-Key: <apiKey>
Content-Type: application/json
Body: {"working": true}
```

Send a keep-alive signal to indicate the agent is working.

**Example:**
```bash
curl -X POST http://localhost:3000/agent/chats/chat_123/activity \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"working": true}'
```

---

### Human API (Band.ai Proxy)

#### Send Message as Human
```bash
POST /me/chats/:chatId/messages
Headers: X-API-Key: <apiKey>
Content-Type: application/json
Body: {
  "message": {
    "content": "@Agent please analyze this",
    "mentions": [{}]
  }
}
```

Send a message as the human user to a chat room.

**Example:**
```bash
curl -X POST http://localhost:3000/me/chats/chat_123/messages \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "content": "@DataAnalyst please analyze the Q4 sales data",
      "mentions": [{}]
    }
  }'
```

---

#### Get Chat Messages
```bash
GET /me/chats/:chatId/messages?limit=50&page=1
Headers: X-API-Key: <apiKey>
```

List messages in a chat room.

**Example:**
```bash
curl -X GET "http://localhost:3000/me/chats/chat_123/messages?limit=50" \
  -H "X-API-Key: your_api_key"
```

---

### Collector Agent Endpoints

#### Collector Check-in
```bash
POST /collector/check-in
Content-Type: application/json
Body: {
  "sessionId": "session_123",
  "status": "active",
  "metadata": {}
}
```

Register collector agent activity for a session.

**Example:**
```bash
curl -X POST http://localhost:3000/collector/check-in \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "status": "active"
  }'
```

---

#### Submit Collected Data
```bash
POST /collector/data
Content-Type: application/json
Body: {
  "sessionId": "session_123",
  "sourceType": "status-report",
  "source": "team-standup",
  "category": "update",
  "priority": "medium",
  "content": {
    "taskId": "TASK-001",
    "status": "in-progress",
    "progress": 75
  }
}
```

Submit data collected by the collector agent.

**Example:**
```bash
curl -X POST http://localhost:3000/collector/data \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "sourceType": "risk-alert",
    "source": "automated-scan",
    "category": "risk",
    "priority": "high",
    "content": {
      "description": "Dependency vulnerability detected",
      "severity": "high"
    }
  }'
```

---

#### Get Collected Data
```bash
GET /collector/data?sessionId=xxx&status=pending&category=risk
```

Retrieve collected data for a session with optional filters.

**Example:**
```bash
curl -X GET "http://localhost:3000/collector/data?sessionId=session_123&status=pending"
```

---

#### Mark Data as Processed
```bash
POST /collector/data/:dataId/process
```

Update the status of collected data to processed.

**Example:**
```bash
curl -X POST http://localhost:3000/collector/data/data_456/process
```

---

### Resource Balancer Agent Endpoints

#### Resource Balancer Check-in
```bash
POST /resource-balancer/check-in
Content-Type: application/json
Body: {
  "sessionId": "session_123",
  "status": "active"
}
```

Register resource balancer agent activity.

---

#### Register Resource
```bash
POST /resource-balancer/resources
Content-Type: application/json
Body: {
  "name": "Senior Developer",
  "type": "human",
  "capacity": 10,
  "availability": "available",
  "skills": ["typescript", "react", "nodejs"]
}
```

Add a new resource to the resource pool.

**Example:**
```bash
curl -X POST http://localhost:3000/resource-balancer/resources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "type": "infrastructure",
    "capacity": 5,
    "availability": "available"
  }'
```

---

#### List Resources
```bash
GET /resource-balancer/resources?type=human&availability=available
```

Get all registered resources with optional filters.

**Example:**
```bash
curl -X GET "http://localhost:3000/resource-balancer/resources?availability=available"
```

---

#### Update Resource Status
```bash
PATCH /resource-balancer/resources/:resourceId
Content-Type: application/json
Body: {
  "availability": "busy",
  "currentLoad": 8
}
```

Update resource availability or load.

---

#### Allocate Resource
```bash
POST /resource-balancer/allocations
Content-Type: application/json
Body: {
  "resourceId": "res_123",
  "sessionId": "session_456",
  "taskId": "TASK-001",
  "estimatedDuration": 3600,
  "priority": "high"
}
```

Create a new resource allocation.

**Example:**
```bash
curl -X POST http://localhost:3000/resource-balancer/allocations \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "res_123",
    "sessionId": "session_456",
    "priority": "high"
  }'
```

---

#### Get Resource Allocations
```bash
GET /resource-balancer/allocations?sessionId=session_123
```

Retrieve allocations for a session.

---

#### Remove Allocation
```bash
DELETE /resource-balancer/allocations/:allocationId
```

Delete an allocation and free up the resource.

---

#### Submit Balancing Recommendation
```bash
POST /resource-balancer/recommendations
Content-Type: application/json
Body: {
  "sessionId": "session_123",
  "type": "load_balancing",
  "severity": "warning",
  "description": "Resource utilization exceeds 80%",
  "affectedResources": ["res_123", "res_456"],
  "suggestedActions": ["Allocate additional resources"],
  "requiresApproval": true
}
```

Create a resource balancing recommendation.

---

#### Get Recommendations
```bash
GET /resource-balancer/recommendations?sessionId=session_123&severity=critical
```

Retrieve recommendations for a session.

---

#### Get Project Metrics
```bash
GET /resource-balancer/metrics?sessionId=session_123
```

Retrieve calculated project metrics including resource utilization, task completion, and risk levels.

**Example:**
```bash
curl -X GET "http://localhost:3000/resource-balancer/metrics?sessionId=session_123"
```

---

### Human-in-the-Loop Endpoints

#### Request Approval
```bash
POST /human/approval-request
Content-Type: application/json
Body: {
  "sessionId": "session_123",
  "agentId": "agent_456",
  "action": "deploy_to_production",
  "context": {
    "description": "Deploy version 2.0",
    "impact": "high"
  }
}
```

Create a new approval request requiring human intervention.

**Example:**
```bash
curl -X POST http://localhost:3000/human/approval-request \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "agentId": "agent_456",
    "action": "deploy_to_production",
    "context": {"description": "Deploy v2.0"}
  }'
```

---

#### Respond to Approval
```bash
POST /human/approval-response
Content-Type: application/json
Body: {
  "requestId": "req_789",
  "approved": true,
  "reason": "Approved after review"
}
```

Respond to a pending approval request.

**Example:**
```bash
curl -X POST http://localhost:3000/human/approval-response \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_789",
    "approved": true,
    "reason": "Looks good"
  }'
```

---

### State Management

#### Get Session State
```bash
GET /state?sessionId=session_123
```

Retrieve the current state of a session.

**Example:**
```bash
curl -X GET "http://localhost:3000/state?sessionId=session_123"
```

---

#### Record State Event
```bash
POST /state/event
Content-Type: application/json
Body: {
  "sessionId": "session_123",
  "agentId": "agent_456",
  "eventType": "task_completed",
  "payload": {
    "taskId": "task_001",
    "result": "success"
  }
}
```

Record a new event in the session state.

**Example:**
```bash
curl -X POST http://localhost:3000/state/event \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "agentId": "agent_456",
    "eventType": "task_completed",
    "payload": {"taskId": "task_001"}
  }'
```

---

### Real-Time Updates

#### Subscribe to Updates (SSE)
```bash
GET /updates?sessionId=session_123
```

Server-Sent Events endpoint for real-time updates about a session.

**Example:**
```javascript
const eventSource = new EventSource('http://localhost:3000/updates?sessionId=session_123');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};
```

**Event Types:**
- `connected` - Initial connection established
- `state_change` - Session state updated
- `approval_request` - New approval request created
- `agent_message` - New agent event recorded
- `error` - Error occurred

---

### Legacy/Demo Endpoints

#### Start Check-in (Legacy)
```bash
GET /demo/start-checkin
Headers: X-API-Key: <apiKey>
```

Legacy endpoint that proxies to `/agent/me`.

---

### Health Check

#### Health Status
```bash
GET /health
```

Returns server health status.

**Example:**
```bash
curl -X GET http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-17T12:00:00.000Z"
}
```

---

## Data Models

### SessionState
```typescript
{
  sessionId: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  agents: Array<{
    agentId: string;
    status: string;
    lastActivity: string;
  }>;
  events: StateEvent[];
  pendingApprovals: ApprovalRequest[];
  createdAt: string;
  updatedAt: string;
}
```

### ApprovalRequest
```typescript
{
  requestId: string;
  sessionId: string;
  agentId: string;
  action: string;
  context: Record<string, any>;
  requestedAt: string;
}
```

### StateEvent
```typescript
{
  eventId: string;
  sessionId: string;
  agentId: string;
  eventType: string;
  payload: Record<string, any>;
  timestamp: string;
}
```

---

## Authentication

All Band.ai proxy endpoints require authentication via either:
1. **X-API-Key header** (preferred for client requests)
2. **BAND_API_KEY environment variable** (fallback)

The API key is obtained from your Band.ai account.

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": "Error description"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (missing/invalid API key)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## Project Structure

```
PM-PLUS/
├── src/
│   ├── index.ts                      # Main server entry point
│   ├── types.ts                      # TypeScript type definitions
│   ├── store.ts                      # Enhanced StateStore with resource tracking
│   ├── services/
│   │   ├── bandai.service.ts         # Band.ai API integration service
│   │   └── orchestrator.service.ts   # Agent orchestration and workflow coordination
│   └── routes/
│       ├── agent.ts                  # Agent API endpoints (Band.ai proxy)
│       ├── messages.ts               # Human API message endpoints
│       ├── human.ts                  # Human-in-the-Loop endpoints
│       ├── state.ts                  # State management endpoints
│       ├── updates.ts                # SSE updates endpoint
│       ├── demo.ts                   # Legacy demo endpoints
│       ├── collector.ts              # Collector agent integration
│       └── resource-balancer.ts      # Resource Balancer agent integration
├── agents/
│   ├── agent_config.yaml             # Agent configuration
│   ├── collector.py                  # Collector agent implementation
│   └── resource_balancer.py          # Resource Balancer agent implementation
├── .env                              # Environment variables
├── .env.example                      # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

---

## Development

### Scripts
- `npm run dev` - Start development server with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled production build

### Key Components

#### StateStore (`src/store.ts`)
Enhanced in-memory state management with:
- Session state tracking
- Resource management (capacity, load, availability)
- Resource allocation tracking
- Collected data storage and processing
- Balancing recommendations
- Agent messages and check-ins
- Project metrics calculation

#### Band.ai Service (`src/services/bandai.service.ts`)
Provides abstraction layer for Band.ai API:
- Agent profile management
- Chat context retrieval
- Activity reporting
- Message sending
- Factory pattern for different agent types

#### Orchestrator Service (`src/services/orchestrator.service.ts`)
Coordinates workflows between agents:
- Workflow coordination
- Data processing and routing
- Risk and blocker handling
- Resource health monitoring
- Approval requirement evaluation
- Agent broadcasting

### Adding New Endpoints

1. Create a new route file in `src/routes/`
2. Import and register it in `src/index.ts`
3. Update this README with documentation
4. Add Swagger/OpenAPI documentation in route file

---

## Integration with Band.ai

This API acts as a proxy and extension layer for Band.ai's Agent and Human APIs:

- **Agent API** - Used by autonomous agents to communicate and report activity
- **Human API** - Used by human users (PMs) to interact with agents
- **Custom Extensions** - State management, approval workflows, and real-time updates

Refer to [Band.ai documentation](https://docs.band.ai) for more details on their API capabilities.

---

## License

MIT
