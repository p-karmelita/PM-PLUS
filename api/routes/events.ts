import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { stateStore } from '../store';
import { AgentMessage } from '../types';

const router = Router();

const EVENT_MAP: Record<string, {
  to: string | undefined;
  messageType: AgentMessage['messageType'];
  loop: string;
}> = {
  // Intermediate step events (real pipeline narrative)
  check_in_received:       { to: 'risk_analyzer',      messageType: 'broadcast',    loop: 'collect' },
  history_query_sent:      { to: 'reporter',            messageType: 'request',      loop: 'loop1'   },
  resource_request_sent:   { to: 'resource_balancer',   messageType: 'request',      loop: 'loop2'   },
  risk_flag_posted:        { to: 'pm',                  messageType: 'notification', loop: 'loop3'   },
  // Response / summary events
  history_responded:       { to: 'risk_analyzer',       messageType: 'response',     loop: 'loop1'   },
  resource_recommended:    { to: 'risk_analyzer',       messageType: 'response',     loop: 'loop2'   },
  risk_flagged:            { to: 'reporter',             messageType: 'notification', loop: 'loop3'   },
  approval_received:       { to: 'risk_analyzer',       messageType: 'notification', loop: 'loop3'   },
  // Reporter archive events
  check_in_archived:       { to: undefined,              messageType: 'broadcast',    loop: 'collect' },
  event_archived:          { to: undefined,              messageType: 'broadcast',    loop: ''        },
  weekly_report_generated: { to: 'pm',                  messageType: 'notification', loop: ''        },
};

function deriveText(eventType: string, content: Record<string, any>): string {
  switch (eventType) {
    case 'check_in_received':
      return `Check-in from ${content.employee_name}: "${content.status}" (workload: ${content.workload})`;
    case 'history_query_sent':
      return `Has ${content.employee_name}'s blocker persisted before? Need history to score severity.`;
    case 'resource_request_sent':
      return `${content.employee_name} is overloaded + blocked. Who has capacity to take the task?`;
    case 'risk_flag_posted':
      return `🚨 RISK FLAG (${content.severity}): ${content.description}. Proposed fix: ${content.recommended_action}. Awaiting PM approval.`;
    case 'history_responded':
      return `History: ${content.summary}`;
    case 'resource_recommended':
      return `Recommending ${content.available_employee} (confidence ${content.confidence})`;
    case 'risk_flagged':
      return `Risk flagged [${content.severity}]: ${content.description || content.risk_type}`;
    case 'approval_received':
      return `Flag ${content.flag_id} ${content.approved ? 'APPROVED ✓' : 'REJECTED ✗'}${content.pm_notes ? ': ' + content.pm_notes : ''}`;
    case 'check_in_archived':
      return `Archived check-in: ${content.employee_name || content.employee_id}`;
    case 'event_archived':
      return `Event archived: ${content.event_kind || ''}`;
    case 'weekly_report_generated':
      return 'Weekly report generated and posted';
    default:
      return typeof content === 'string' ? content : JSON.stringify(content).slice(0, 120);
  }
}

/**
 * POST /events/agent
 * Receives an AgentEvent dict from the Python on_event() bridge and broadcasts
 * it to all active SSE sessions so the dashboard reflects real-mode activity.
 */
router.post('/agent', (req: Request, res: Response) => {
  const { event_type, agent_name, content = {}, timestamp } = req.body;

  if (!event_type || !agent_name) {
    return res.status(400).json({ error: 'event_type and agent_name are required' });
  }

  const mapping = EVENT_MAP[event_type] ?? {
    to: undefined,
    messageType: 'notification' as const,
    loop: '',
  };

  const message: AgentMessage = {
    messageId: uuidv4(),
    sessionId: '*',  // wildcard — store broadcasts to every active SSE subscriber
    // check_in_received is emitted by risk_analyzer but the logical sender is the collector
    fromAgentId: event_type === 'check_in_received' ? 'collector' : agent_name,
    toAgentId: mapping.to,
    messageType: mapping.messageType,
    content: {
      text: deriveText(event_type, content),
      ...(mapping.loop ? { loop: mapping.loop } : {}),
      event_type,
      ...content,
    },
    sentAt: timestamp || new Date().toISOString(),
  };

  stateStore.broadcastAgentEvent(message);

  // When the risk flag is posted to Band, also create the HITL approval card
  // in every active dashboard session so the Decision Panel appears in real mode.
  if (event_type === 'risk_flag_posted') {
    stateStore.broadcastApprovalRequest({
      agentId: agent_name,
      action:  `Reassign ${content.employee_name ?? 'team member'}'s task`,
      context: {
        flag_id:            content.flag_id,
        severity:           content.severity,
        risk_type:          content.risk_type,
        employee_name:      content.employee_name,
        description:        content.description,
        recommended_action: content.recommended_action,
      },
    });
  }

  res.status(202).json({ ok: true });
});

export default router;
