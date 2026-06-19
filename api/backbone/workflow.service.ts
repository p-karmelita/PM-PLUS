import { stateStore as legacyStore } from '../store';
import type {
  AgentMessage as LegacyAgentMessage,
  ApprovalRequest as LegacyApprovalRequest,
} from '../types';
import { CollectorAgent } from './collector.agent';
import {
  ApplyDecisionInput,
  AuditDecisionInput,
  DecisionService,
  RecordDecisionInput,
  SkipDecisionInput,
} from './decision.service';
import { PMChatService, SendPMChatInput, SendPMChatResult } from './pm-chat.service';
import { ReporterAgent } from './reporter.agent';
import { ResourceBalancerAgent } from './resource-balancer.agent';
import { RiskAnalyzerAgent } from './risk-analyzer.agent';
import { backboneStore, BackboneStore } from './store';
import {
  AgentMessage,
  AgentMessageType,
  AgentName,
  DecisionStatus,
  Employee,
  Project,
  ProjectAnalytics,
  ProjectStateSnapshot,
  RiskSeverity,
  SubmitUpdateRequest,
  SubmitUpdateResponse,
  WeeklyReport,
  WorkloadLevel,
} from './types';
import { newId, nowIso, resolveCorrelationId, toTitleCase } from './utils';
import { notificationService } from './notification.service';

function ensureLegacySession(projectId: string): void {
  if (!legacyStore.getSession(projectId)) {
    legacyStore.createSession(projectId, 'collector');
  }
}

function toLegacyMessage(message: AgentMessage): LegacyAgentMessage {
  const target = message.targetAgents[0];
  const payload = (message.payload as Record<string, unknown>) || {};
  const text =
    String(payload.text || payload.question || payload.riskTitle || payload.issue || message.type) ||
    message.type;

  const messageType =
    message.type === 'DECISION_REQUESTED'
      ? 'request'
      : message.type === 'PM_DECISION_RECORDED'
      ? 'response'
      : 'notification';

  return {
    messageId: message.messageId,
    sessionId: message.projectId,
    fromAgentId: message.sourceAgent,
    toAgentId: target,
    messageType,
    content: {
      text,
      event_type: message.type,
      ...payload,
    },
    sentAt: message.timestamp,
  };
}

function maybeToLegacyApproval(message: AgentMessage): LegacyApprovalRequest | null {
  if (message.type !== 'DECISION_REQUESTED') return null;
  const payload = (message.payload as Record<string, unknown>) || {};
  return {
    requestId: String(payload.decisionId || message.decisionId || message.messageId),
    sessionId: message.projectId,
    agentId: message.sourceAgent,
    action: String(payload.question || 'Decision required'),
    context: payload,
    requestedAt: message.timestamp,
  };
}

export class WorkflowService {
  private collector: CollectorAgent;
  private riskAnalyzer: RiskAnalyzerAgent;
  private resourceBalancer: ResourceBalancerAgent;
  private reporter: ReporterAgent;
  private decisions: DecisionService;
  private pmChat: PMChatService;

  constructor(private readonly store: BackboneStore = backboneStore) {
    this.collector = new CollectorAgent(this.store);
    this.riskAnalyzer = new RiskAnalyzerAgent(this.store);
    this.resourceBalancer = new ResourceBalancerAgent(this.store);
    this.reporter = new ReporterAgent(this.store);
    this.decisions = new DecisionService(this.store);
    this.pmChat = new PMChatService(this.store);
  }

  seedTeam(projectId: string): { projectId: string; employees: Employee[] } {
    const now = nowIso();
    const existing = this.store.getProject(projectId);
    const project: Project = existing || {
      projectId,
      name: `Project ${toTitleCase(projectId.replace(/[-_]/g, ' '))}`,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    project.updatedAt = now;
    this.store.saveProject(project);

    const team: Employee[] = [
      {
        employeeId: 'alice',
        projectId,
        employeeName: 'Alice',
        role: 'Frontend Engineer',
        currentWorkload: 'normal',
        updatedAt: now,
      },
      {
        employeeId: 'bob',
        projectId,
        employeeName: 'Bob',
        role: 'Backend Engineer',
        currentWorkload: 'light',
        updatedAt: now,
      },
      {
        employeeId: 'carol',
        projectId,
        employeeName: 'Carol',
        role: 'QA Engineer',
        currentWorkload: 'normal',
        updatedAt: now,
      },
    ];

    for (const employee of team) {
      this.store.saveEmployee(employee);
    }
    ensureLegacySession(projectId);
    return { projectId, employees: this.store.listEmployees(projectId) };
  }

  startDailyCheckin(projectId: string): { projectId: string; correlationId: string; questions: string[] } {
    if (!this.store.getProject(projectId)) {
      this.seedTeam(projectId);
    }
    const correlationId = resolveCorrelationId();
    const message: AgentMessage = {
      messageId: newId('msg'),
      correlationId,
      type: 'CHECKIN_REQUESTED',
      sourceAgent: 'collector',
      targetAgents: ['orchestrator', 'reporter'],
      projectId,
      payload: {
        questions: [
          'What did you finish yesterday?',
          'What are you working on today?',
          'Are you blocked?',
          'How heavy is your workload?',
          'Do you need help?',
        ],
      },
      timestamp: nowIso(),
    };
    this.publishMessages([message]);

    return {
      projectId,
      correlationId,
      questions: (message.payload as { questions: string[] }).questions,
    };
  }

  submitUpdate(payload: SubmitUpdateRequest): SubmitUpdateResponse {
    if (!payload.projectId) {
      throw new Error('projectId is required');
    }
    const project = this.store.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project "${payload.projectId}" not found. Seed team first.`);
    }
    const employee = this.store.getEmployee(payload.projectId, payload.employeeId);
    if (!employee) {
      throw new Error(`Employee "${payload.employeeId}" not found in project "${payload.projectId}"`);
    }
    if (employee.employeeName !== payload.employeeName) {
      throw new Error(
        `Employee name mismatch for "${payload.employeeId}". Expected "${employee.employeeName}".`
      );
    }

    const correlationId = resolveCorrelationId(payload.correlationId);

    const received: AgentMessage = {
      messageId: newId('msg'),
      correlationId,
      type: 'DAILY_UPDATE_RECEIVED',
      sourceAgent: 'orchestrator',
      targetAgents: ['collector'],
      projectId: payload.projectId,
      payload: {
        employeeId: payload.employeeId,
        employeeName: payload.employeeName,
      },
      timestamp: nowIso(),
    };

    const collectorResult = this.collector.collect(payload, correlationId);
    const riskResult = this.riskAnalyzer.evaluate(collectorResult.update, correlationId);
    const rebalanceResult = this.resourceBalancer.evaluateProject(payload.projectId, correlationId);

    const messages: AgentMessage[] = [
      received,
      collectorResult.collectedMessage,
      ...riskResult.messages,
      ...rebalanceResult.messages,
    ];
    this.publishMessages(messages);

    const pendingApprovals = this.store
      .listPendingDecisionRequests(payload.projectId)
      .filter((item) => item.correlationId === correlationId)
      .map((item) => ({
        decisionId: item.decisionId,
        type: item.category,
        title: item.category === 'risk_escalation' ? 'Risk escalation decision' : 'Resource rebalance decision',
        question: item.question,
      }));

    return {
      updateId: collectorResult.update.updateId,
      correlationId,
      eventsCreated: messages.map((item) => item.type),
      pendingApprovals,
    };
  }

  recordDecision(input: RecordDecisionInput): { status: string; messages: AgentMessageType[] } {
    const result = this.decisions.record(input);
    this.publishMessages(result.messages);
    return {
      status: input.decision === 'approve' ? 'approved' : 'rejected',
      messages: result.messages.map((item) => item.type),
    };
  }

  applyDecision(input: ApplyDecisionInput): { status: string; messages: AgentMessageType[] } {
    const messages = this.decisions.apply(input);
    this.publishMessages(messages);
    return {
      status: 'applied',
      messages: messages.map((item) => item.type),
    };
  }

  skipDecision(input: SkipDecisionInput): { status: string; messages: AgentMessageType[] } {
    const messages = this.decisions.skip(input);
    this.publishMessages(messages);
    return {
      status: 'skipped',
      messages: messages.map((item) => item.type),
    };
  }

  auditDecision(input: AuditDecisionInput): { status: string; messages: AgentMessageType[] } {
    const messages = this.decisions.audit(input);
    this.publishMessages(messages);
    return {
      status: 'audited',
      messages: messages.map((item) => item.type),
    };
  }

  sendPMChatMessage(input: SendPMChatInput): SendPMChatResult {
    if (!this.store.getProject(input.projectId)) {
      this.seedTeam(input.projectId);
    }
    const result = this.pmChat.send(input);
    this.publishMessages(result.agentEvents);
    return result;
  }

  confirmPMChatDraft(projectId: string, threadId: string): ReturnType<PMChatService['confirmDraft']> {
    const result = this.pmChat.confirmDraft(projectId, threadId);
    this.publishMessages([result.event]);
    return result;
  }

  generateWeeklyReport(projectId: string): WeeklyReport {
    const { report, generatedMessage } = this.reporter.generateWeeklyReport(projectId);
    this.publishMessages([generatedMessage]);
    return report;
  }

  runFullScenario(projectId: string): {
    projectId: string;
    updatesProcessed: number;
    decisionsRecorded: number;
    reportId: string;
  } {
    this.seedTeam(projectId);
    this.startDailyCheckin(projectId);

    const scenario: SubmitUpdateRequest[] = [
      {
        projectId,
        employeeId: 'alice',
        employeeName: 'Alice',
        yesterday: 'Prepared deployment checklist',
        today: 'Need to finish production deployment',
        blockers: ['Waiting on IT access'],
        workload: 'heavy',
        needsHelp: true,
      },
      {
        projectId,
        employeeId: 'bob',
        employeeName: 'Bob',
        yesterday: 'Finished API docs',
        today: 'Available to help',
        blockers: [],
        workload: 'light',
        needsHelp: false,
      },
      {
        projectId,
        employeeId: 'carol',
        employeeName: 'Carol',
        yesterday: 'Prepared QA plan',
        today: 'Waiting for deployment to start QA',
        blockers: ['Blocked until deployment is done'],
        workload: 'normal',
        needsHelp: true,
      },
    ];

    for (const update of scenario) {
      this.submitUpdate(update);
    }

    const pending = this.store.listPendingDecisionRequests(projectId);
    for (const request of pending) {
      this.recordDecision({
        projectId,
        decisionId: request.decisionId,
        decision: 'approve',
        decidedBy: 'pm-user',
        comment: 'Approved in demo scenario',
      });
    }

    const report = this.generateWeeklyReport(projectId);
    return {
      projectId,
      updatesProcessed: scenario.length,
      decisionsRecorded: pending.length,
      reportId: report.reportId,
    };
  }

  getState(projectId: string): ProjectStateSnapshot {
    return this.store.getProjectState(projectId);
  }

  getAnalytics(projectId: string): ProjectAnalytics {
    const employees = this.store.listEmployees(projectId);
    const updates = this.store.listUpdates(projectId);
    const messages = this.store.listMessages(projectId);
    const risks = this.store.listRisks(projectId);
    const recommendations = this.store.listRecommendations(projectId);
    const decisions = this.store.listDecisionRequests(projectId);
    const reportEntries = this.store.listReportEntries(projectId);

    const decisionStatusCounts = this.initCountMap<DecisionStatus>([
      'draft',
      'pending',
      'pending_pm',
      'approved',
      'rejected',
      'applied',
      'skipped',
      'audited',
    ]);
    for (const decision of decisions) {
      decisionStatusCounts[decision.status] += 1;
    }

    const workloadCounts = this.initCountMap<WorkloadLevel>(['light', 'normal', 'heavy']);
    for (const employee of employees) {
      workloadCounts[employee.currentWorkload] += 1;
    }

    const riskSeverityCounts = this.initCountMap<RiskSeverity>(['low', 'medium', 'high', 'critical']);
    for (const risk of risks) {
      riskSeverityCounts[risk.severity] += 1;
    }

    const agentNames: AgentName[] = [
      'collector',
      'risk_analyzer',
      'resource_balancer',
      'reporter',
      'orchestrator',
      'pm',
    ];
    const agentPerformance = agentNames.map((agentName) => {
      const sent = messages.filter((message) => message.sourceAgent === agentName);
      const received = messages.filter((message) => message.targetAgents.includes(agentName));
      const decisionRequests = decisions.filter((decision) => decision.requestedBy === agentName);
      const entries = agentName === 'reporter' ? reportEntries : [];
      const lastSent = sent.at(-1)?.timestamp;
      const lastReceived = received.at(-1)?.timestamp;
      const lastActivityAt =
        [lastSent, lastReceived]
          .filter(Boolean)
          .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0] || undefined;

      return {
        agentName,
        messagesSent: sent.length,
        messagesReceived: received.length,
        decisionsRequested: decisionRequests.length,
        reportEntriesCreated: entries.length,
        lastActivityAt,
      };
    });

    return {
      projectId,
      generatedAt: nowIso(),
      totals: {
        employees: employees.length,
        updates: updates.length,
        agentMessages: messages.length,
        risks: risks.length,
        recommendations: recommendations.length,
        decisions: decisions.length,
        reportEntries: reportEntries.length,
      },
      decisionStatusCounts,
      workloadCounts,
      riskSeverityCounts,
      agentPerformance,
    };
  }

  ingestMessage(message: AgentMessage): void {
    this.publishMessages([message]);
  }

  private publishMessages(messages: AgentMessage[]): void {
    for (const message of messages) {
      this.store.appendMessage(message);

      // Reporter consumes every message emitted by all agents.
      if (message.type !== 'REPORT_ENTRY_CREATED') {
        const reportEntryMessage = this.reporter.recordMessage(message);
        this.store.appendMessage(reportEntryMessage);
        this.publishToLegacy(reportEntryMessage);
      }

      this.publishToLegacy(message);
      void notificationService.notifyForAgentMessage(message);
    }
  }

  private publishToLegacy(message: AgentMessage): void {
    ensureLegacySession(message.projectId);
    legacyStore.addAgentMessage(toLegacyMessage(message));
    const approval = maybeToLegacyApproval(message);
    if (approval) {
      legacyStore.addApprovalRequest(message.projectId, approval);
    }
  }

  private initCountMap<T extends string>(keys: T[]): Record<T, number> {
    return keys.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as Record<T, number>);
  }
}

export const workflowService = new WorkflowService();
