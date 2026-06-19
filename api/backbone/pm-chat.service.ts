import { BackboneStore } from './store';
import {
  AgentMessage,
  AgentName,
  DecisionRequest,
  PMChatIntent,
  PMChatMessage,
  PMChatThread,
} from './types';
import { newId, nowIso, resolveCorrelationId } from './utils';

export interface SendPMChatInput {
  projectId: string;
  threadId?: string;
  targetAgent?: AgentName;
  message: string;
  intent?: PMChatIntent;
}

export interface SendPMChatResult {
  thread: PMChatThread;
  messages: PMChatMessage[];
  decisionDraft?: DecisionRequest;
  agentEvents: AgentMessage[];
}

function inferTargetAgent(message: string, explicit?: AgentName): AgentName {
  if (explicit) return explicit;
  const lower = message.toLowerCase();
  if (lower.includes('report') || lower.includes('history') || lower.includes('summary')) return 'reporter';
  if (lower.includes('risk') || lower.includes('blocker') || lower.includes('escalat')) return 'risk_analyzer';
  if (lower.includes('capacity') || lower.includes('reassign') || lower.includes('rebalance') || lower.includes('workload')) {
    return 'resource_balancer';
  }
  if (lower.includes('check-in') || lower.includes('checkin') || lower.includes('update')) return 'collector';
  return 'orchestrator';
}

function inferIntent(message: string, explicit?: PMChatIntent): PMChatIntent {
  if (explicit) return explicit;
  const lower = message.toLowerCase();
  if (lower.includes('apply') || lower.includes('execute')) return 'execute';
  if (lower.includes('approve') || lower.includes('decide') || lower.includes('should we')) return 'decide';
  if (lower.includes('propose') || lower.includes('recommend') || lower.includes('reassign') || lower.includes('escalat')) {
    return 'propose';
  }
  return 'ask';
}

function titleFrom(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  return trimmed.length > 72 ? `${trimmed.slice(0, 69)}...` : trimmed || 'PM chat';
}

export class PMChatService {
  constructor(private readonly store: BackboneStore) {}

  send(input: SendPMChatInput): SendPMChatResult {
    if (!input.projectId || !input.message.trim()) {
      throw new Error('projectId and message are required');
    }

    const targetAgent = inferTargetAgent(input.message, input.targetAgent);
    const intent = inferIntent(input.message, input.intent);
    const timestamp = nowIso();

    const existingThread = input.threadId
      ? this.store.getPMChatThread(input.projectId, input.threadId)
      : null;

    const thread: PMChatThread =
      existingThread || {
        threadId: newId('thread'),
        projectId: input.projectId,
        title: titleFrom(input.message),
        targetAgent,
        status: 'open',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

    const pmMessage: PMChatMessage = {
      messageId: newId('chat'),
      threadId: thread.threadId,
      projectId: input.projectId,
      role: 'pm',
      intent,
      content: input.message.trim(),
      createdAt: timestamp,
    };
    this.store.savePMChatMessage(pmMessage);

    const decisionDraft = this.createDecisionDraftIfNeeded(thread, targetAgent, intent, input.message);
    const response = this.composeAgentResponse(input.projectId, targetAgent, intent, input.message, decisionDraft);

    const agentMessage: PMChatMessage = {
      messageId: newId('chat'),
      threadId: thread.threadId,
      projectId: input.projectId,
      role: 'agent',
      agentName: targetAgent,
      intent,
      content: response,
      decisionId: decisionDraft?.decisionId,
      createdAt: nowIso(),
    };
    this.store.savePMChatMessage(agentMessage);

    const updatedThread: PMChatThread = {
      ...thread,
      targetAgent,
      status: decisionDraft ? 'decision_drafted' : thread.status,
      decisionId: decisionDraft?.decisionId || thread.decisionId,
      updatedAt: nowIso(),
    };
    this.store.savePMChatThread(updatedThread);

    const chatEvent: AgentMessage = {
      messageId: newId('msg'),
      correlationId: decisionDraft?.correlationId || resolveCorrelationId(),
      type: 'PM_CHAT_MESSAGE_SENT',
      sourceAgent: 'pm',
      targetAgents: [targetAgent],
      projectId: input.projectId,
      payload: {
        threadId: updatedThread.threadId,
        intent,
        message: input.message,
        response,
      },
      timestamp: nowIso(),
    };

    const events = [chatEvent];
    if (decisionDraft) {
      events.push({
        messageId: newId('msg'),
        correlationId: decisionDraft.correlationId,
        type: 'DECISION_DRAFTED',
        sourceAgent: targetAgent,
        targetAgents: ['pm', 'reporter'],
        projectId: input.projectId,
        payload: decisionDraft,
        timestamp: nowIso(),
        requiresDecision: true,
        decisionId: decisionDraft.decisionId,
      });
    }

    return {
      thread: updatedThread,
      messages: [pmMessage, agentMessage],
      decisionDraft,
      agentEvents: events,
    };
  }

  confirmDraft(projectId: string, threadId: string): { thread: PMChatThread; decision: DecisionRequest; event: AgentMessage } {
    const thread = this.store.getPMChatThread(projectId, threadId);
    if (!thread || !thread.decisionId) {
      throw new Error(`No decision draft found for thread "${threadId}"`);
    }
    const decision = this.store.getDecisionRequest(projectId, thread.decisionId);
    if (!decision) {
      throw new Error(`Decision draft "${thread.decisionId}" not found`);
    }
    if (decision.status !== 'draft') {
      throw new Error(`Decision "${decision.decisionId}" is already ${decision.status}`);
    }

    this.store.updateDecisionRequestStatus(projectId, decision.decisionId, 'pending_pm');
    const updatedDecision = this.store.getDecisionRequest(projectId, decision.decisionId)!;
    const updatedThread: PMChatThread = {
      ...thread,
      status: 'decision_pending',
      updatedAt: nowIso(),
    };
    this.store.savePMChatThread(updatedThread);

    const event: AgentMessage = {
      messageId: newId('msg'),
      correlationId: updatedDecision.correlationId,
      type: 'DECISION_REQUESTED',
      sourceAgent: updatedDecision.requestedBy,
      targetAgents: ['pm', 'reporter'],
      projectId,
      payload: updatedDecision,
      timestamp: nowIso(),
      requiresDecision: true,
      decisionId: updatedDecision.decisionId,
    };

    return { thread: updatedThread, decision: updatedDecision, event };
  }

  private createDecisionDraftIfNeeded(
    thread: PMChatThread,
    targetAgent: AgentName,
    intent: PMChatIntent,
    message: string
  ): DecisionRequest | undefined {
    if (intent === 'ask' || targetAgent === 'reporter' || targetAgent === 'collector') {
      return undefined;
    }

    const projectId = thread.projectId;
    const employees = this.store.listEmployees(projectId);
    const overloaded = employees.find((employee) => employee.currentWorkload === 'heavy') || employees[0];
    const available =
      employees.find((employee) => employee.currentWorkload === 'light' && employee.employeeId !== overloaded?.employeeId) ||
      employees.find((employee) => employee.employeeId !== overloaded?.employeeId);

    const category = targetAgent === 'risk_analyzer' ? 'risk_escalation' : 'resource_rebalance';
    const decisionId = newId('decision');
    const correlationId = resolveCorrelationId();
    const suggestedAction =
      category === 'risk_escalation'
        ? `Escalate the blocker described by PM: "${message.trim()}".`
        : `Move a non-critical support task from ${overloaded?.employeeName || 'the overloaded owner'} to ${
            available?.employeeName || 'the available teammate'
          }.`;

    const draft: DecisionRequest = {
      decisionId,
      projectId,
      correlationId,
      category,
      status: 'draft',
      lifecycleStage: 'draft',
      question:
        category === 'risk_escalation'
          ? 'Should this risk escalation be submitted for PM approval?'
          : 'Should this resource rebalance be submitted for PM approval?',
      options: ['approve', 'reject'],
      requestedBy: targetAgent,
      origin: 'pm_chat',
      context: {
        threadId: thread.threadId,
        pmMessage: message,
        overloadedEmployeeId: overloaded?.employeeId,
        overloadedEmployeeName: overloaded?.employeeName,
        availableEmployeeId: available?.employeeId,
        availableEmployeeName: available?.employeeName,
        suggestedAction,
      },
      requestedAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.store.saveDecisionRequest(draft);
    return draft;
  }

  private composeAgentResponse(
    projectId: string,
    targetAgent: AgentName,
    intent: PMChatIntent,
    message: string,
    decisionDraft?: DecisionRequest
  ): string {
    const snapshot = this.store.getProjectState(projectId);
    if (targetAgent === 'reporter') {
      return `Reporter summary: ${snapshot.updates.length} updates, ${snapshot.risks.length} risks, ${snapshot.decisionsPending.length} pending decisions. Latest request: "${message.trim()}".`;
    }
    if (targetAgent === 'risk_analyzer') {
      return decisionDraft
        ? `Risk Analyzer prepared a decision draft. Confirm it to create a formal PM approval request.`
        : `Risk Analyzer sees ${snapshot.risks.length} active risk signals and can draft an escalation if needed.`;
    }
    if (targetAgent === 'resource_balancer') {
      return decisionDraft
        ? `Resource Balancer prepared a rebalance draft. Confirm it to send the action into PM approval.`
        : `Resource Balancer sees ${snapshot.resourceRecommendations.length} recommendations and ${snapshot.employees.length} team members.`;
    }
    if (targetAgent === 'collector') {
      return `Collector can start a check-in or normalize a submitted update. Current intent: ${intent}.`;
    }
    return `Orchestrator recorded the PM request and can route it to a specialist agent.`;
  }
}
