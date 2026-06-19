import { BackboneStore } from './store';
import { AgentMessage, DailyUpdate, DecisionRequest, RiskAlert, RiskSeverity } from './types';
import { newId, nowIso } from './utils';

export interface RiskAnalyzerResult {
  risk?: RiskAlert;
  decisionRequest?: DecisionRequest;
  messages: AgentMessage[];
}

function inferSeverity(update: DailyUpdate): RiskSeverity {
  const text = `${update.today || ''} ${update.yesterday || ''} ${update.blockers.join(' ')}`.toLowerCase();
  const hasCriticalKeywords =
    text.includes('production') ||
    text.includes('deploy') ||
    text.includes('critical') ||
    text.includes('outage');

  if (update.blockers.length === 0 && !update.needsHelp) return 'low';
  if (hasCriticalKeywords && update.workload === 'heavy') return 'critical';
  if (update.workload === 'heavy' || update.blockers.length > 0) return 'high';
  if (update.needsHelp) return 'medium';
  return 'low';
}

export class RiskAnalyzerAgent {
  constructor(private readonly store: BackboneStore) {}

  evaluate(update: DailyUpdate, correlationId: string): RiskAnalyzerResult {
    if (update.blockers.length === 0 && !update.needsHelp) {
      return { messages: [] };
    }

    const severity = inferSeverity(update);
    const riskId = newId('risk');
    const requiresDecision = severity === 'high' || severity === 'critical';
    const decisionId = requiresDecision ? newId('decision') : undefined;
    const blockerPhrase = update.blockers[0] || 'blocking dependency';

    const risk: RiskAlert = {
      riskId,
      projectId: update.projectId,
      correlationId,
      employeeId: update.employeeId,
      employeeName: update.employeeName,
      riskTitle: `${blockerPhrase} may delay delivery`,
      severity,
      reason: `${update.employeeName} reported blocker: ${blockerPhrase}`,
      recommendedAction:
        'Ask dependency owner for ETA and unblock today; keep PM in the loop if deadline impact is likely.',
      requiresDecision,
      decisionId,
      status: requiresDecision ? 'pending_pm' : 'pending',
      createdAt: nowIso(),
    };

    this.store.saveRisk(risk);

    const messages: AgentMessage[] = [
      {
        messageId: newId('msg'),
        correlationId,
        type: 'RISK_ALERT_CREATED',
        sourceAgent: 'risk_analyzer',
        targetAgents: ['reporter'],
        projectId: update.projectId,
        payload: risk,
        timestamp: nowIso(),
        requiresDecision,
        decisionId,
      },
    ];

    if (!requiresDecision || !decisionId) {
      return { risk, messages };
    }

    const decisionRequest: DecisionRequest = {
      decisionId,
      projectId: update.projectId,
      correlationId,
      category: 'risk_escalation',
      status: 'pending_pm',
      lifecycleStage: 'pending_pm',
      question: `Should PM approve escalation for ${update.employeeName}'s blocker?`,
      options: ['approve', 'reject'],
      requestedBy: 'risk_analyzer',
      origin: 'workflow',
      context: {
        riskId,
        employeeId: update.employeeId,
        employeeName: update.employeeName,
        severity,
        blocker: blockerPhrase,
        recommendedAction: risk.recommendedAction,
      },
      requestedAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.store.saveDecisionRequest(decisionRequest);

    messages.push({
      messageId: newId('msg'),
      correlationId,
      type: 'DECISION_REQUESTED',
      sourceAgent: 'risk_analyzer',
      targetAgents: ['pm', 'reporter'],
      projectId: update.projectId,
      payload: decisionRequest,
      timestamp: nowIso(),
      requiresDecision: true,
      decisionId,
    });

    return { risk, decisionRequest, messages };
  }
}
