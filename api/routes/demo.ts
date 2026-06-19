import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { stateStore } from '../store';
import { AgentMessage, ApprovalRequest, CollectedData } from '../types';

const router = Router();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET /demo/start-checkin
 * Fetches agent information from Band.ai API
 * Requires X-API-Key header
 */
router.get('/start-checkin', async (req: Request, res: Response) => {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || process.env.BAND_API_KEY;

    if (!apiKey) {
      return res.status(401).json({
        error: 'X-API-Key header or BAND_API_KEY env variable is required'
      });
    }

    const url = 'https://app.band.ai/api/v1/agent/me';
    const options = {
      method: 'GET',
      headers: { 'X-API-Key': apiKey }
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Band.ai API error: ${response.statusText}`
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error in start-checkin:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /demo/session:
 *   post:
 *     tags:
 *       - Demo / PM Plus
 *     summary: Create a dashboard session
 *     description: >
 *       Creates an in-memory session directly (no Band.ai call) so the PM Plus
 *       dashboard can open its SSE connection (GET /updates) before any events fire.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Optional client-supplied id; generated when omitted.
 *     responses:
 *       201:
 *         description: Session created (or already existed)
 */
router.post('/session', (req: Request, res: Response) => {
  try {
    const sessionId = (req.body && req.body.sessionId) || `pm-plus-${uuidv4().slice(0, 8)}`;

    let session = stateStore.getSession(sessionId);
    if (!session) {
      session = stateStore.createSession(sessionId, 'collector');
    }

    res.status(201).json({ sessionId, status: session.status });
  } catch (error) {
    console.error('Error in demo/session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Helper: emit an inter-agent message into the store (drives the live message log).
 */
function emitMessage(
  sessionId: string,
  from: string,
  to: string,
  text: string,
  loop?: string,
  extra: Record<string, any> = {}
): void {
  const message: AgentMessage = {
    messageId: uuidv4(),
    sessionId,
    fromAgentId: from,
    toAgentId: to,
    messageType: extra.messageType || 'notification',
    content: { text, loop, ...extra },
    sentAt: new Date().toISOString()
  };
  stateStore.addAgentMessage(message);
}

/**
 * Scripted, time-delayed walkthrough of the full closed loop. Runs in the
 * background (not awaited by the request) so each step streams to the dashboard
 * via SSE. No Band.ai / LLM / keys required.
 */
async function runSimulation(sessionId: string): Promise<void> {
  try {
    await sleep(500); // give the client a moment to connect its EventSource

    // Loop 0 — Collector gathers a check-in
    emitMessage(
      sessionId,
      'collector',
      'risk_analyzer',
      "Check-in from Alice: \"Still waiting for IT to fix my access. Third day.\" (workload: heavy)",
      'collect',
      { messageType: 'broadcast', employee: 'Alice' }
    );
    const aliceData: CollectedData = {
      dataId: uuidv4(),
      sessionId,
      sourceType: 'check-in',
      source: 'Alice',
      category: 'blocker',
      priority: 'high',
      content: {
        employee_name: 'Alice',
        status: 'Still waiting for IT to fix my access. Third day.',
        blockers: 'IT ticket unresolved 3 days.',
        workload: 'heavy'
      },
      collectedAt: new Date().toISOString(),
      status: 'pending'
    };
    stateStore.addCollectedData(aliceData);
    stateStore.calculateProjectMetrics(sessionId);

    // Loop 1 — Risk Analyzer ↔ Reporter (historical context)
    await sleep(1400);
    emitMessage(sessionId, 'risk_analyzer', 'reporter',
      "Has Alice's IT-access blocker persisted before? Need history to score severity.",
      'loop1', { messageType: 'request' });

    await sleep(1400);
    emitMessage(sessionId, 'reporter', 'risk_analyzer',
      "Yes — 3rd time this sprint. Same IT blocker recurred on days 2 and 5. Risk count: 3.",
      'loop1', { messageType: 'response', risk_count: 3 });

    // Loop 2 — Risk Analyzer ↔ Resource Balancer (negotiation)
    await sleep(1400);
    emitMessage(sessionId, 'risk_analyzer', 'resource_balancer',
      "Alice is overloaded + blocked. Who has capacity to take the API task?",
      'loop2', { messageType: 'request' });

    await sleep(1400);
    emitMessage(sessionId, 'resource_balancer', 'risk_analyzer',
      "Bob is available (light workload, finished early). Confidence 0.8. Suggest reassigning the API task to Bob.",
      'loop2', { messageType: 'response', available_employee: 'Bob', confidence: 0.8 });

    // Loop 3 — Risk Analyzer escalates to the PM for approval (HITL)
    await sleep(1400);
    const flagId = `f-${uuidv4().slice(0, 8)}`;
    emitMessage(sessionId, 'risk_analyzer', 'pm',
      "🚨 RISK FLAG (HIGH): Alice blocked 3 days on IT + overloaded. Proposed fix: reassign API task to Bob. Awaiting PM approval.",
      'loop3', { messageType: 'notification', flag_id: flagId, severity: 'HIGH' });

    const request: ApprovalRequest = {
      requestId: uuidv4(),
      sessionId,
      agentId: 'risk_analyzer',
      action: "Reassign Alice's API task to Bob",
      context: {
        flag_id: flagId,
        severity: 'HIGH',
        risk_type: 'overload',
        employee_name: 'Alice',
        description: 'Alice blocked 3 days on IT access and carrying a heavy workload; blocker has recurred 3× this sprint.',
        recommended_action: 'Move the API task to Bob (available, confidence 0.8) and escalate the IT ticket.'
      },
      requestedAt: new Date().toISOString()
    };
    stateStore.addApprovalRequest(sessionId, request);
  } catch (error) {
    console.error('Error during demo simulation:', error);
  }
}

/**
 * @openapi
 * /demo/simulate:
 *   post:
 *     tags:
 *       - Demo / PM Plus
 *     summary: Run the offline scripted demo
 *     description: >
 *       Streams a scripted check-in → Loop 1 (history) → Loop 2 (negotiation) →
 *       Loop 3 (PM approval request) sequence into the session so the dashboard
 *       shows the full closed loop live. Self-contained — no Band.ai/LLM needed.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       202:
 *         description: Simulation started; events stream via GET /updates
 */
router.post('/simulate', (req: Request, res: Response) => {
  try {
    const sessionId = (req.body && req.body.sessionId) || `pm-plus-${uuidv4().slice(0, 8)}`;

    if (!stateStore.getSession(sessionId)) {
      stateStore.createSession(sessionId, 'collector');
    }

    // Fire-and-forget: the scripted sequence streams over SSE.
    void runSimulation(sessionId);

    res.status(202).json({ sessionId, status: 'simulation_started' });
  } catch (error) {
    console.error('Error in demo/simulate:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const REAL_CHECKINS = [
  {
    type: 'check_in', employee_id: 'e1', employee_name: 'Alice',
    status: 'Still waiting for IT to fix my access. Third day.',
    blockers: 'IT ticket unresolved 3 days.', workload: 'heavy'
  },
  {
    type: 'check_in', employee_id: 'e2', employee_name: 'Bob',
    status: 'All tasks done ahead of schedule.', workload: 'light'
  },
  {
    type: 'check_in', employee_id: 'e3', employee_name: 'Carol',
    status: 'Blocked on Alice finishing the API.',
    blockers: 'Dependency on Alice.', workload: 'normal'
  }
];

/**
 * @openapi
 * /demo/trigger-real:
 *   post:
 *     tags:
 *       - Demo / PM Plus
 *     summary: Trigger the real Band.ai agent pipeline
 *     description: >
 *       TypeScript port of src/mock_collector.py — posts the Alice/Bob/Carol
 *       check-ins to the Band OPS room with an @risk_analyzer mention, driving the
 *       genuine Python agent pipeline. Requires OPS_ROOM_ID, RISK_ANALYZER_AGENT_ID
 *       and a posting key (REPORTER_API_KEY) in the environment.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       202:
 *         description: Check-ins posted to Band
 *       400:
 *         description: Band.ai environment not configured
 */
router.post('/trigger-real', async (req: Request, res: Response) => {
  const opsRoom = process.env.OPS_ROOM_ID;
  const apiKey = process.env.REPORTER_API_KEY || process.env.RISK_ANALYZER_API_KEY;
  const riskAgentId = process.env.RISK_ANALYZER_AGENT_ID;
  const bandUrl = 'https://app.band.ai/api/v1';

  if (!opsRoom || !apiKey || !riskAgentId) {
    return res.status(400).json({
      error:
        'Real mode needs OPS_ROOM_ID, RISK_ANALYZER_AGENT_ID and REPORTER_API_KEY in the environment. ' +
        'Use the Simulated demo to run offline.'
    });
  }

  const sessionId = (req.body && req.body.sessionId) || `pm-plus-${uuidv4().slice(0, 8)}`;
  if (!stateStore.getSession(sessionId)) {
    stateStore.createSession(sessionId, 'collector');
  }

  const results: Array<{ employee: string; status: number }> = [];
  try {
    for (const checkin of REAL_CHECKINS) {
      const r = await fetch(`${bandUrl}/agent/chats/${opsRoom}/messages`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            content: `@risk_analyzer ${JSON.stringify(checkin)}`,
            mentions: [{ id: riskAgentId, name: 'risk_analyzer', handle: 'risk_analyzer' }]
          }
        })
      });
      results.push({ employee: checkin.employee_name, status: r.status });

      // Mirror the trigger into the local stream so the dashboard reflects it.
      emitMessage(
        sessionId,
        'collector',
        'risk_analyzer',
        `Posted real check-in for ${checkin.employee_name} to Band → HTTP ${r.status}`,
        'real',
        { messageType: 'broadcast', employee: checkin.employee_name }
      );
    }

    res.status(202).json({ sessionId, mode: 'real', posted: results });
  } catch (error) {
    console.error('Error in demo/trigger-real:', error);
    res.status(502).json({ error: 'Failed to post check-ins to Band.ai', posted: results });
  }
});

export default router;
