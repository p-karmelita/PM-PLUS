import { Router, Request, Response } from 'express';
import { stateStore } from '../store';

const router = Router();

interface StoredEvent {
  source_agent: string;
  event_kind: string;
  payload: Record<string, any>;
  timestamp: string;
}

interface StoredCheckIn {
  employee_id: string;
  employee_name: string;
  status: string;
  blockers?: string;
  workload: string;
  timestamp: string;
}

const events: StoredEvent[] = [];
const checkIns: StoredCheckIn[] = [];

/**
 * GET /events?employee_id=xxx&days=30
 * Reporter fetches past events to build history context for LLM.
 */
router.get('/events', (req: Request, res: Response) => {
  const { employee_id, days } = req.query;
  const daysNum = parseInt(days as string) || 30;
  const since = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

  let result = events.filter(e => new Date(e.timestamp) >= since);

  if (employee_id) {
    result = result.filter(e =>
      e.payload?.employee_id === employee_id ||
      e.payload?.employee_name === employee_id
    );
  }

  res.json(result);
});

/**
 * POST /events
 * Reporter archives EventLog entries (risk_flagged, etc.)
 */
router.post('/events', (req: Request, res: Response) => {
  const event: StoredEvent = {
    ...req.body,
    timestamp: req.body.timestamp || new Date().toISOString(),
  };
  events.push(event);
  res.status(201).json({ ok: true });
});

/**
 * POST /checkins
 * Reporter archives CheckInMessage entries.
 */
router.post('/checkins', (req: Request, res: Response) => {
  const checkIn: StoredCheckIn = {
    ...req.body,
    timestamp: req.body.timestamp || new Date().toISOString(),
  };
  checkIns.push(checkIn);
  res.status(201).json({ ok: true });
});

/**
 * GET /weekly-snapshot
 * Merges two sources:
 *   1. reporter's own in-memory arrays (populated by the Python agent in real mode)
 *   2. StateStore collectedData / agentMessages (populated by simulated demo + trigger-real)
 */
router.get('/weekly-snapshot', (_req: Request, res: Response) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // --- source 1: Python agent archives (real mode) ---
  const recentEvents = events.filter(e => new Date(e.timestamp) >= since);
  const recentCheckIns = checkIns.filter(c => new Date(c.timestamp) >= since);

  // --- source 2: StateStore (simulated demo + trigger-real) ---
  const storeData = stateStore.getAllCollectedData().filter(
    d => new Date(d.collectedAt) >= since
  );
  const storeMessages = stateStore.getAllAgentMessages().filter(
    m => new Date(m.sentAt) >= since
  );

  // Derive check-ins from StateStore collected data (sourceType === 'check-in')
  const storeCheckInNames = new Set(recentCheckIns.map(c => c.employee_name));
  for (const d of storeData) {
    if (d.sourceType === 'check-in' && !storeCheckInNames.has(d.source)) {
      recentCheckIns.push({
        employee_id:   d.content?.employee_id || d.source,
        employee_name: d.source,
        status:        d.content?.status || '',
        blockers:      d.content?.blockers,
        workload:      d.content?.workload || 'normal',
        timestamp:     d.collectedAt,
      });
      storeCheckInNames.add(d.source);
    }
  }

  // Derive risk events from StateStore agent messages (loop3 risk flags)
  const storeEventKeys = new Set(recentEvents.map(e => e.payload?.flag_id).filter(Boolean));
  for (const m of storeMessages) {
    const c = m.content as any;
    if (c?.event_type === 'risk_flagged' && c?.flag_id && !storeEventKeys.has(c.flag_id)) {
      recentEvents.push({
        source_agent: m.fromAgentId,
        event_kind:   'risk_flagged',
        payload:      c,
        timestamp:    m.sentAt,
      });
      storeEventKeys.add(c.flag_id);
    }
    // Also catch risk flags written by the simulated demo (loop: 'loop3', severity present)
    if (c?.severity && c?.employee_name && c?.loop === 'loop3' && !storeEventKeys.has(c?.flag_id)) {
      const key = `${c.employee_name}-${m.sentAt}`;
      if (!storeEventKeys.has(key)) {
        recentEvents.push({
          source_agent: m.fromAgentId,
          event_kind:   'risk_flagged',
          payload:      c,
          timestamp:    m.sentAt,
        });
        storeEventKeys.add(key);
      }
    }
  }

  // Fallback: derive risk flags from approval requests (populated by both modes)
  const approvalFlagIds = new Set(recentEvents.map(e => e.payload?.flag_id).filter(Boolean));
  for (const session of stateStore.getAllActiveSessions()) {
    for (const req of session.pendingApprovals) {
      const ctx = req.context as any;
      if (ctx?.flag_id && !approvalFlagIds.has(ctx.flag_id)) {
        recentEvents.push({
          source_agent: req.agentId || 'risk_analyzer',
          event_kind:   'risk_flagged',
          payload:      ctx,
          timestamp:    req.requestedAt,
        });
        approvalFlagIds.add(ctx.flag_id);
      }
    }
  }

  const riskFlags = recentEvents.filter(e => e.event_kind === 'risk_flagged');
  const byEmployee: Record<string, { checkIns: StoredCheckIn[]; risks: any[] }> = {};

  for (const ci of recentCheckIns) {
    const name = ci.employee_name;
    if (!byEmployee[name]) byEmployee[name] = { checkIns: [], risks: [] };
    byEmployee[name].checkIns.push(ci);
  }

  for (const rf of riskFlags) {
    const name = rf.payload?.employee_name;
    if (name) {
      if (!byEmployee[name]) byEmployee[name] = { checkIns: [], risks: [] };
      byEmployee[name].risks.push(rf.payload);
    }
  }

  res.json({
    period_days:     7,
    total_events:    recentEvents.length,
    total_check_ins: recentCheckIns.length,
    risk_flags:      riskFlags.length,
    by_employee:     byEmployee,
    events:          recentEvents,
  });
});

export default router;
