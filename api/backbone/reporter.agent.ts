import { BackboneStore } from './store';
import { AgentMessage, ReportEntry, WeeklyReport } from './types';
import { newId, nowIso } from './utils';

function summarizeMessage(message: AgentMessage): string {
  switch (message.type) {
    case 'DAILY_UPDATE_COLLECTED': {
      const payload = message.payload as { employeeName?: string; blockers?: string[]; workload?: string };
      return `${payload.employeeName || 'Employee'} submitted update (workload: ${payload.workload || 'n/a'}, blockers: ${payload.blockers?.length || 0}).`;
    }
    case 'RISK_ALERT_CREATED': {
      const payload = message.payload as { riskTitle?: string; severity?: string };
      return `Risk flagged: ${payload.riskTitle || 'unspecified'} (severity: ${payload.severity || 'unknown'}).`;
    }
    case 'RESOURCE_REBALANCE_RECOMMENDED': {
      const payload = message.payload as { overloadedEmployeeName?: string; availableEmployeeName?: string };
      return `Rebalance recommendation: ${payload.overloadedEmployeeName || 'n/a'} -> ${payload.availableEmployeeName || 'n/a'}.`;
    }
    case 'DECISION_REQUESTED': {
      const payload = message.payload as { question?: string };
      return `Decision requested: ${payload.question || 'approval required'}.`;
    }
    case 'PM_DECISION_RECORDED': {
      const payload = message.payload as { decision?: string; decisionId?: string };
      return `PM decision recorded (${payload.decision || 'n/a'}) for ${payload.decisionId || 'n/a'}.`;
    }
    case 'PM_CHAT_MESSAGE_SENT': {
      const payload = message.payload as { intent?: string; threadId?: string };
      return `PM chat routed (${payload.intent || 'ask'}) in ${payload.threadId || 'thread'}.`;
    }
    case 'DECISION_DRAFTED': {
      const payload = message.payload as { decisionId?: string; category?: string };
      return `Decision draft created (${payload.category || 'general'}) for ${payload.decisionId || 'n/a'}.`;
    }
    case 'DECISION_APPLIED': {
      const payload = message.payload as { decisionId?: string; appliedBy?: string };
      return `Decision ${payload.decisionId || 'n/a'} applied by ${payload.appliedBy || 'PM'}.`;
    }
    case 'DECISION_SKIPPED': {
      const payload = message.payload as { decisionId?: string; skippedBy?: string };
      return `Decision ${payload.decisionId || 'n/a'} skipped by ${payload.skippedBy || 'PM'}.`;
    }
    case 'DECISION_AUDITED': {
      const payload = message.payload as { decisionId?: string; auditedBy?: string };
      return `Decision ${payload.decisionId || 'n/a'} audited by ${payload.auditedBy || 'PM'}.`;
    }
    case 'SCHEDULER_RUN_COMPLETED': {
      const payload = message.payload as { summary?: string };
      return payload.summary || 'Scheduler run completed.';
    }
    case 'WEEKLY_REPORT_GENERATED':
      return 'Weekly report generated.';
    default:
      return `${message.type} recorded.`;
  }
}

export class ReporterAgent {
  constructor(private readonly store: BackboneStore) {}

  recordMessage(message: AgentMessage): AgentMessage<ReportEntry> {
    const entry: ReportEntry = {
      entryId: newId('entry'),
      projectId: message.projectId,
      correlationId: message.correlationId,
      sourceMessageId: message.messageId,
      messageType: message.type,
      summary: summarizeMessage(message),
      payload: (message.payload as Record<string, unknown>) || {},
      createdAt: nowIso(),
    };
    this.store.saveReportEntry(entry);

    return {
      messageId: newId('msg'),
      correlationId: message.correlationId,
      type: 'REPORT_ENTRY_CREATED',
      sourceAgent: 'reporter',
      targetAgents: ['orchestrator'],
      projectId: message.projectId,
      payload: entry,
      timestamp: nowIso(),
    };
  }

  generateWeeklyReport(projectId: string): { report: WeeklyReport; generatedMessage: AgentMessage<WeeklyReport> } {
    const updates = this.store.listUpdates(projectId);
    const risks = this.store.listRisks(projectId);
    const recommendations = this.store.listRecommendations(projectId);
    const decisions = this.store.listDecisions(projectId);
    const latestCorrelationId =
      this.store.listMessages(projectId).at(-1)?.correlationId || `corr-${projectId}`;

    const progress = updates.map(
      (update) => `${update.employeeName}: yesterday "${update.yesterday || 'n/a'}", today "${update.today || 'n/a'}".`
    );
    const blockers = updates
      .filter((update) => update.blockers.length > 0)
      .map((update) => `${update.employeeName}: ${update.blockers.join('; ')}`);
    const riskLines = risks.map((risk) => `${risk.severity.toUpperCase()} risk: ${risk.riskTitle}`);
    const workloadLines = this.store
      .listEmployees(projectId)
      .map((employee) => `${employee.employeeName}: ${employee.currentWorkload}`);
    const decisionLines = decisions.map(
      (decision) => `${decision.decidedBy} ${decision.decision}d ${decision.decisionId}`
    );
    const nextSteps = [
      'Confirm blocker owner ETA within 24h.',
      'Apply approved resource support changes as a managed PM action.',
      'Monitor heavy workloads at next check-in.',
    ];

    const markdown = [
      `# Weekly Project Report — ${this.store.getProject(projectId)?.name || projectId}`,
      '',
      '## Progress',
      ...(progress.length ? progress.map((item) => `- ${item}`) : ['- No updates recorded.']),
      '',
      '## Blockers',
      ...(blockers.length ? blockers.map((item) => `- ${item}`) : ['- No blockers reported.']),
      '',
      '## Risks',
      ...(riskLines.length ? riskLines.map((item) => `- ${item}`) : ['- No risks flagged.']),
      '',
      '## Workload',
      ...(workloadLines.length ? workloadLines.map((item) => `- ${item}`) : ['- No workload data.']),
      '',
      '## Decisions',
      ...(decisionLines.length ? decisionLines.map((item) => `- ${item}`) : ['- No PM decisions recorded.']),
      '',
      '## Recommended Next Steps',
      ...nextSteps.map((item) => `- ${item}`),
    ].join('\n');

    const report: WeeklyReport = {
      reportId: newId('report'),
      projectId,
      generatedAt: nowIso(),
      markdown,
      progress,
      blockers,
      risks: riskLines,
      workload: workloadLines,
      decisions: decisionLines,
      nextSteps,
    };

    this.store.saveWeeklyReport(report);

    const generatedMessage: AgentMessage<WeeklyReport> = {
      messageId: newId('msg'),
      correlationId: latestCorrelationId,
      type: 'WEEKLY_REPORT_GENERATED',
      sourceAgent: 'reporter',
      targetAgents: ['pm', 'orchestrator'],
      projectId,
      payload: report,
      timestamp: nowIso(),
    };

    return { report, generatedMessage };
  }
}
