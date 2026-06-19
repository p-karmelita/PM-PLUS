import {
  AgentMessage,
  DailyUpdate,
  DecisionRecord,
  DecisionRequest,
  DecisionStatus,
  Employee,
  PMChatMessage,
  PMChatThread,
  Project,
  ProjectStateSnapshot,
  ReportEntry,
  ResourceRecommendation,
  RiskAlert,
  SchedulerState,
  WeeklyReport,
  WorkloadLevel,
} from './types';
import fs from 'fs';
import path from 'path';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class BackboneStore {
  private projects = new Map<string, Project>();
  private employees = new Map<string, Map<string, Employee>>();
  private updates = new Map<string, DailyUpdate[]>();
  private messages = new Map<string, AgentMessage[]>();
  private risks = new Map<string, RiskAlert[]>();
  private recommendations = new Map<string, ResourceRecommendation[]>();
  private decisionRequests = new Map<string, DecisionRequest[]>();
  private decisions = new Map<string, DecisionRecord[]>();
  private reportEntries = new Map<string, ReportEntry[]>();
  private weeklyReports = new Map<string, WeeklyReport>();
  private pmChatThreads = new Map<string, PMChatThread[]>();
  private pmChatMessages = new Map<string, PMChatMessage[]>();
  private scheduler: SchedulerState = {
    enabled: process.env.SCHEDULER_ENABLED === 'true',
    dailyCheckinTime: process.env.DAILY_CHECKIN_TIME || '09:00',
    weeklyReportDay: process.env.WEEKLY_REPORT_DAY || 'friday',
    weeklyReportTime: process.env.WEEKLY_REPORT_TIME || '16:00',
  };

  constructor(
    private readonly dataFile = process.env.BACKBONE_STORE_FILE ||
      path.join(process.cwd(), 'data', 'backbone-store.json')
  ) {
    this.loadFromDisk();
  }

  saveProject(project: Project): void {
    this.projects.set(project.projectId, clone(project));
    this.persist();
  }

  getProject(projectId: string): Project | null {
    const project = this.projects.get(projectId);
    return project ? clone(project) : null;
  }

  saveEmployee(employee: Employee): void {
    const scoped = this.employees.get(employee.projectId) ?? new Map<string, Employee>();
    scoped.set(employee.employeeId, clone(employee));
    this.employees.set(employee.projectId, scoped);
    this.persist();
  }

  getEmployee(projectId: string, employeeId: string): Employee | null {
    const scoped = this.employees.get(projectId);
    if (!scoped) return null;
    const employee = scoped.get(employeeId);
    return employee ? clone(employee) : null;
  }

  listEmployees(projectId: string): Employee[] {
    const scoped = this.employees.get(projectId);
    if (!scoped) return [];
    return Array.from(scoped.values()).map((item) => clone(item));
  }

  updateEmployeeWorkload(projectId: string, employeeId: string, workload: WorkloadLevel): void {
    const scoped = this.employees.get(projectId);
    if (!scoped || !scoped.has(employeeId)) {
      throw new Error(`Unknown employee "${employeeId}" in project "${projectId}"`);
    }
    const current = scoped.get(employeeId)!;
    scoped.set(employeeId, {
      ...current,
      currentWorkload: workload,
      updatedAt: new Date().toISOString(),
    });
    this.persist();
  }

  saveUpdate(update: DailyUpdate): void {
    const scoped = this.updates.get(update.projectId) ?? [];
    scoped.push(clone(update));
    this.updates.set(update.projectId, scoped);
    this.persist();
  }

  listUpdates(projectId: string): DailyUpdate[] {
    return (this.updates.get(projectId) ?? []).map((item) => clone(item));
  }

  appendMessage(message: AgentMessage): void {
    const scoped = this.messages.get(message.projectId) ?? [];
    scoped.push(clone(message));
    this.messages.set(message.projectId, scoped);
    this.persist();
  }

  listMessages(projectId: string): AgentMessage[] {
    return (this.messages.get(projectId) ?? []).map((item) => clone(item));
  }

  saveRisk(risk: RiskAlert): void {
    const scoped = this.risks.get(risk.projectId) ?? [];
    scoped.push(clone(risk));
    this.risks.set(risk.projectId, scoped);
    this.persist();
  }

  listRisks(projectId: string): RiskAlert[] {
    return (this.risks.get(projectId) ?? []).map((item) => clone(item));
  }

  updateRiskStatus(projectId: string, riskId: string, status: DecisionStatus): void {
    const scoped = this.risks.get(projectId) ?? [];
    const index = scoped.findIndex((risk) => risk.riskId === riskId);
    if (index < 0) return;
    scoped[index] = { ...scoped[index], status };
    this.persist();
  }

  saveRecommendation(recommendation: ResourceRecommendation): void {
    const scoped = this.recommendations.get(recommendation.projectId) ?? [];
    scoped.push(clone(recommendation));
    this.recommendations.set(recommendation.projectId, scoped);
    this.persist();
  }

  listRecommendations(projectId: string): ResourceRecommendation[] {
    return (this.recommendations.get(projectId) ?? []).map((item) => clone(item));
  }

  findPendingRecommendation(input: {
    projectId: string;
    overloadedEmployeeId: string;
    availableEmployeeId: string;
  }): ResourceRecommendation | null {
    const scoped = this.recommendations.get(input.projectId) ?? [];
    const match = scoped.find(
      (item) =>
        item.overloadedEmployeeId === input.overloadedEmployeeId &&
        item.availableEmployeeId === input.availableEmployeeId &&
        (item.status === 'pending' || item.status === 'pending_pm')
    );
    return match ? clone(match) : null;
  }

  updateRecommendationStatus(
    projectId: string,
    recommendationId: string,
    status: DecisionStatus
  ): void {
    const scoped = this.recommendations.get(projectId) ?? [];
    const index = scoped.findIndex((item) => item.recommendationId === recommendationId);
    if (index < 0) return;
    scoped[index] = { ...scoped[index], status };
    this.persist();
  }

  saveDecisionRequest(request: DecisionRequest): void {
    const scoped = this.decisionRequests.get(request.projectId) ?? [];
    scoped.push(clone(request));
    this.decisionRequests.set(request.projectId, scoped);
    this.persist();
  }

  getDecisionRequest(projectId: string, decisionId: string): DecisionRequest | null {
    const scoped = this.decisionRequests.get(projectId) ?? [];
    const match = scoped.find((item) => item.decisionId === decisionId);
    return match ? clone(match) : null;
  }

  listDecisionRequests(projectId: string): DecisionRequest[] {
    return (this.decisionRequests.get(projectId) ?? []).map((item) => clone(item));
  }

  listPendingDecisionRequests(projectId: string): DecisionRequest[] {
    return this.listDecisionRequests(projectId).filter(
      (item) => item.status === 'pending' || item.status === 'pending_pm'
    );
  }

  updateDecisionRequestStatus(
    projectId: string,
    decisionId: string,
    status: DecisionStatus
  ): void {
    const scoped = this.decisionRequests.get(projectId) ?? [];
    const index = scoped.findIndex((item) => item.decisionId === decisionId);
    if (index < 0) return;
    scoped[index] = {
      ...scoped[index],
      status,
      lifecycleStage: status === 'pending' ? 'pending_pm' : status,
      updatedAt: new Date().toISOString(),
      ...(status === 'applied' ? { appliedAt: new Date().toISOString() } : {}),
      ...(status === 'audited' ? { auditedAt: new Date().toISOString() } : {}),
    };
    this.persist();
  }

  saveDecision(decision: DecisionRecord): void {
    const scoped = this.decisions.get(decision.projectId) ?? [];
    scoped.push(clone(decision));
    this.decisions.set(decision.projectId, scoped);
    this.persist();
  }

  listDecisions(projectId: string): DecisionRecord[] {
    return (this.decisions.get(projectId) ?? []).map((item) => clone(item));
  }

  saveReportEntry(entry: ReportEntry): void {
    const scoped = this.reportEntries.get(entry.projectId) ?? [];
    scoped.push(clone(entry));
    this.reportEntries.set(entry.projectId, scoped);
    this.persist();
  }

  listReportEntries(projectId: string): ReportEntry[] {
    return (this.reportEntries.get(projectId) ?? []).map((item) => clone(item));
  }

  saveWeeklyReport(report: WeeklyReport): void {
    this.weeklyReports.set(report.projectId, clone(report));
    this.persist();
  }

  getWeeklyReport(projectId: string): WeeklyReport | null {
    const report = this.weeklyReports.get(projectId);
    return report ? clone(report) : null;
  }

  savePMChatThread(thread: PMChatThread): void {
    const scoped = this.pmChatThreads.get(thread.projectId) ?? [];
    const index = scoped.findIndex((item) => item.threadId === thread.threadId);
    if (index >= 0) {
      scoped[index] = clone(thread);
    } else {
      scoped.push(clone(thread));
    }
    this.pmChatThreads.set(thread.projectId, scoped);
    this.persist();
  }

  getPMChatThread(projectId: string, threadId: string): PMChatThread | null {
    const thread = (this.pmChatThreads.get(projectId) ?? []).find((item) => item.threadId === threadId);
    return thread ? clone(thread) : null;
  }

  listPMChatThreads(projectId: string): PMChatThread[] {
    return (this.pmChatThreads.get(projectId) ?? []).map((item) => clone(item));
  }

  savePMChatMessage(message: PMChatMessage): void {
    const scoped = this.pmChatMessages.get(message.projectId) ?? [];
    scoped.push(clone(message));
    this.pmChatMessages.set(message.projectId, scoped);
    this.persist();
  }

  listPMChatMessages(projectId: string, threadId?: string): PMChatMessage[] {
    const messages = this.pmChatMessages.get(projectId) ?? [];
    const filtered = threadId ? messages.filter((message) => message.threadId === threadId) : messages;
    return filtered.map((item) => clone(item));
  }

  getSchedulerState(): SchedulerState {
    return clone(this.scheduler);
  }

  updateSchedulerState(patch: Partial<SchedulerState>): SchedulerState {
    this.scheduler = { ...this.scheduler, ...patch };
    this.persist();
    return this.getSchedulerState();
  }

  getProjectState(projectId: string): ProjectStateSnapshot {
    return {
      project: this.getProject(projectId),
      employees: this.listEmployees(projectId),
      updates: this.listUpdates(projectId),
      agentMessages: this.listMessages(projectId),
      risks: this.listRisks(projectId),
      resourceRecommendations: this.listRecommendations(projectId),
      decisionsAll: this.listDecisionRequests(projectId),
      decisionsPending: this.listPendingDecisionRequests(projectId),
      decisionsHistory: this.listDecisions(projectId),
      reportEntries: this.listReportEntries(projectId),
      weeklyReport: this.getWeeklyReport(projectId),
      pmChatThreads: this.listPMChatThreads(projectId),
      pmChatMessages: this.listPMChatMessages(projectId),
      scheduler: this.getSchedulerState(),
    };
  }

  private loadFromDisk(): void {
    if (!fs.existsSync(this.dataFile)) return;

    try {
      const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8')) as {
        projects?: Project[];
        employees?: Employee[];
        updates?: DailyUpdate[];
        messages?: AgentMessage[];
        risks?: RiskAlert[];
        recommendations?: ResourceRecommendation[];
        decisionRequests?: DecisionRequest[];
        decisions?: DecisionRecord[];
        reportEntries?: ReportEntry[];
        weeklyReports?: WeeklyReport[];
        pmChatThreads?: PMChatThread[];
        pmChatMessages?: PMChatMessage[];
        scheduler?: SchedulerState;
      };

      for (const project of data.projects ?? []) this.projects.set(project.projectId, project);
      for (const employee of data.employees ?? []) {
        const scoped = this.employees.get(employee.projectId) ?? new Map<string, Employee>();
        scoped.set(employee.employeeId, employee);
        this.employees.set(employee.projectId, scoped);
      }
      this.hydrateProjectArray(this.updates, data.updates ?? [], 'projectId');
      this.hydrateProjectArray(this.messages, data.messages ?? [], 'projectId');
      this.hydrateProjectArray(this.risks, data.risks ?? [], 'projectId');
      this.hydrateProjectArray(this.recommendations, data.recommendations ?? [], 'projectId');
      this.hydrateProjectArray(this.decisionRequests, data.decisionRequests ?? [], 'projectId');
      this.hydrateProjectArray(this.decisions, data.decisions ?? [], 'projectId');
      this.hydrateProjectArray(this.reportEntries, data.reportEntries ?? [], 'projectId');
      for (const report of data.weeklyReports ?? []) this.weeklyReports.set(report.projectId, report);
      this.hydrateProjectArray(this.pmChatThreads, data.pmChatThreads ?? [], 'projectId');
      this.hydrateProjectArray(this.pmChatMessages, data.pmChatMessages ?? [], 'projectId');
      if (data.scheduler) {
        this.scheduler = { ...this.scheduler, ...data.scheduler };
      }
    } catch (error) {
      console.error('Failed to load BackboneStore from disk:', error);
    }
  }

  private hydrateProjectArray<T extends Record<string, any>>(
    target: Map<string, T[]>,
    values: T[],
    projectKey: keyof T
  ): void {
    for (const value of values) {
      const projectId = String(value[projectKey]);
      const scoped = target.get(projectId) ?? [];
      scoped.push(value);
      target.set(projectId, scoped);
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
      const payload = {
        projects: Array.from(this.projects.values()),
        employees: Array.from(this.employees.values()).flatMap((scoped) => Array.from(scoped.values())),
        updates: Array.from(this.updates.values()).flat(),
        messages: Array.from(this.messages.values()).flat(),
        risks: Array.from(this.risks.values()).flat(),
        recommendations: Array.from(this.recommendations.values()).flat(),
        decisionRequests: Array.from(this.decisionRequests.values()).flat(),
        decisions: Array.from(this.decisions.values()).flat(),
        reportEntries: Array.from(this.reportEntries.values()).flat(),
        weeklyReports: Array.from(this.weeklyReports.values()),
        pmChatThreads: Array.from(this.pmChatThreads.values()).flat(),
        pmChatMessages: Array.from(this.pmChatMessages.values()).flat(),
        scheduler: this.scheduler,
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(payload, null, 2));
    } catch (error) {
      console.error('Failed to persist BackboneStore:', error);
    }
  }
}

export const backboneStore = new BackboneStore();
