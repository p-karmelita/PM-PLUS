import { BackboneStore } from './store';
import { AgentMessage, DecisionRecord, DecisionValue } from './types';
import { newId, nowIso } from './utils';

export interface RecordDecisionInput {
  projectId: string;
  decisionId: string;
  decision: DecisionValue;
  decidedBy: string;
  comment?: string;
}

export interface RecordDecisionResult {
  decision: DecisionRecord;
  messages: AgentMessage[];
}

export interface ApplyDecisionInput {
  projectId: string;
  decisionId: string;
  appliedBy: string;
  note?: string;
}

export interface AuditDecisionInput {
  projectId: string;
  decisionId: string;
  auditedBy: string;
  note?: string;
}

export interface SkipDecisionInput {
  projectId: string;
  decisionId: string;
  skippedBy: string;
  note?: string;
}

export class DecisionService {
  constructor(private readonly store: BackboneStore) {}

  record(input: RecordDecisionInput): RecordDecisionResult {
    const request = this.store.getDecisionRequest(input.projectId, input.decisionId);
    if (!request) {
      throw new Error(`Decision request "${input.decisionId}" not found`);
    }
    if (request.status !== 'pending' && request.status !== 'pending_pm') {
      throw new Error(`Decision request "${input.decisionId}" is already ${request.status}`);
    }

    const status = input.decision === 'approve' ? 'approved' : 'rejected';
    this.store.updateDecisionRequestStatus(input.projectId, input.decisionId, status);

    if (request.category === 'risk_escalation') {
      const riskId = String(request.context.riskId || '');
      if (riskId) {
        this.store.updateRiskStatus(input.projectId, riskId, status);
      }
    }
    if (request.category === 'resource_rebalance') {
      const recommendationId = String(request.context.recommendationId || '');
      if (recommendationId) {
        this.store.updateRecommendationStatus(input.projectId, recommendationId, status);
      }
    }

    const decision: DecisionRecord = {
      decisionId: input.decisionId,
      projectId: input.projectId,
      correlationId: request.correlationId,
      decision: input.decision,
      decidedBy: input.decidedBy,
      comment: input.comment,
      decidedAt: nowIso(),
      lifecycleStage: status,
    };
    this.store.saveDecision(decision);

    const messages: AgentMessage[] = [
      {
        messageId: newId('msg'),
        correlationId: request.correlationId,
        type: 'PM_DECISION_RECORDED',
        sourceAgent: 'orchestrator',
        targetAgents: ['risk_analyzer', 'resource_balancer', 'reporter'],
        projectId: input.projectId,
        payload: decision,
        timestamp: nowIso(),
      },
    ];

    if (request.category === 'risk_escalation' && input.decision === 'approve') {
      messages.push({
        messageId: newId('msg'),
        correlationId: request.correlationId,
        type: 'ESCALATION_DRAFTED',
        sourceAgent: 'risk_analyzer',
        targetAgents: ['reporter', 'pm'],
        projectId: input.projectId,
        payload: {
          decisionId: request.decisionId,
          draft: `Escalate blocker for ${request.context.employeeName || 'employee'} to dependency owner.`,
        },
        timestamp: nowIso(),
      });
    }

    if (request.category === 'resource_rebalance' && input.decision === 'approve') {
      messages.push({
        messageId: newId('msg'),
        correlationId: request.correlationId,
        type: 'TASK_REASSIGNMENT_PROPOSED',
        sourceAgent: 'resource_balancer',
        targetAgents: ['reporter', 'pm'],
        projectId: input.projectId,
        payload: {
          decisionId: request.decisionId,
          suggestedAction: request.context.suggestedAction,
          note: 'Recommendation approved; assignment mutation remains a manual PM action in MVP.',
        },
        timestamp: nowIso(),
      });
    }

    return { decision, messages };
  }

  apply(input: ApplyDecisionInput): AgentMessage[] {
    const request = this.store.getDecisionRequest(input.projectId, input.decisionId);
    if (!request) {
      throw new Error(`Decision request "${input.decisionId}" not found`);
    }
    if (request.status !== 'approved') {
      throw new Error(`Decision request "${input.decisionId}" must be approved before apply`);
    }

    this.store.updateDecisionRequestStatus(input.projectId, input.decisionId, 'applied');
    this.updateLinkedActionStatus(request, 'applied');

    return [
      {
        messageId: newId('msg'),
        correlationId: request.correlationId,
        type: 'DECISION_APPLIED',
        sourceAgent: 'orchestrator',
        targetAgents: ['reporter', request.requestedBy],
        projectId: input.projectId,
        payload: {
          decisionId: input.decisionId,
          appliedBy: input.appliedBy,
          note: input.note || null,
          action: request.context.suggestedAction || request.context.recommendedAction || request.question,
        },
        timestamp: nowIso(),
      },
    ];
  }

  skip(input: SkipDecisionInput): AgentMessage[] {
    const request = this.store.getDecisionRequest(input.projectId, input.decisionId);
    if (!request) {
      throw new Error(`Decision request "${input.decisionId}" not found`);
    }
    if (request.status !== 'approved') {
      throw new Error(`Decision request "${input.decisionId}" must be approved before skip`);
    }

    this.store.updateDecisionRequestStatus(input.projectId, input.decisionId, 'skipped');
    this.updateLinkedActionStatus(request, 'skipped');

    return [
      {
        messageId: newId('msg'),
        correlationId: request.correlationId,
        type: 'DECISION_SKIPPED',
        sourceAgent: 'orchestrator',
        targetAgents: ['reporter', request.requestedBy],
        projectId: input.projectId,
        payload: {
          decisionId: input.decisionId,
          skippedBy: input.skippedBy,
          note: input.note || null,
          action: request.context.suggestedAction || request.context.recommendedAction || request.question,
        },
        timestamp: nowIso(),
      },
    ];
  }

  audit(input: AuditDecisionInput): AgentMessage[] {
    const request = this.store.getDecisionRequest(input.projectId, input.decisionId);
    if (!request) {
      throw new Error(`Decision request "${input.decisionId}" not found`);
    }
    if (request.status !== 'applied' && request.status !== 'skipped') {
      throw new Error(`Decision request "${input.decisionId}" must be applied or skipped before audit`);
    }

    this.store.updateDecisionRequestStatus(input.projectId, input.decisionId, 'audited');

    return [
      {
        messageId: newId('msg'),
        correlationId: request.correlationId,
        type: 'DECISION_AUDITED',
        sourceAgent: 'orchestrator',
        targetAgents: ['reporter'],
        projectId: input.projectId,
        payload: {
          decisionId: input.decisionId,
          auditedBy: input.auditedBy,
          note: input.note || null,
        },
        timestamp: nowIso(),
      },
    ];
  }

  private updateLinkedActionStatus(
    request: ReturnType<BackboneStore['getDecisionRequest']>,
    status: 'applied' | 'skipped'
  ): void {
    if (!request) return;
    if (request.category === 'risk_escalation') {
      const riskId = String(request.context.riskId || '');
      if (riskId) {
        this.store.updateRiskStatus(request.projectId, riskId, status);
      }
    }
    if (request.category === 'resource_rebalance') {
      const recommendationId = String(request.context.recommendationId || '');
      if (recommendationId) {
        this.store.updateRecommendationStatus(request.projectId, recommendationId, status);
      }
    }
  }
}
