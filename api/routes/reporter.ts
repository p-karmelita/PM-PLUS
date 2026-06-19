import { Router, Request, Response } from 'express';

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
 * Reporter fetches this to generate the weekly PM report.
 */
router.get('/weekly-snapshot', (req: Request, res: Response) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentEvents = events.filter(e => new Date(e.timestamp) >= since);
  const recentCheckIns = checkIns.filter(c => new Date(c.timestamp) >= since);

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
    period_days: 7,
    total_events: recentEvents.length,
    total_check_ins: recentCheckIns.length,
    risk_flags: riskFlags.length,
    by_employee: byEmployee,
    events: recentEvents,
  });
});

export default router;
