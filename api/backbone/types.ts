export type WorkloadLevel = 'light' | 'normal' | 'heavy';
export type AgentName =
  | 'collector'
  | 'risk_analyzer'
  | 'resource_balancer'
  | 'reporter'
  | 'orchestrator'
  | 'pm';
export type DecisionStatus =
  | 'draft'
  | 'pending'
  | 'pending_pm'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'skipped'
  | 'audited';
export type DecisionLifecycleStage =
  | 'draft'
  | 'pending_pm'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'skipped'
  | 'audited';
export type DecisionValue = 'approve' | 'reject';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AgentMessageType =
  | 'CHECKIN_REQUESTED'
  | 'DAILY_UPDATE_RECEIVED'
  | 'DAILY_UPDATE_COLLECTED'
  | 'RISK_ALERT_CREATED'
  | 'RESOURCE_REBALANCE_RECOMMENDED'
  | 'DECISION_REQUESTED'
  | 'PM_DECISION_RECORDED'
  | 'ESCALATION_DRAFTED'
  | 'TASK_REASSIGNMENT_PROPOSED'
  | 'REPORT_ENTRY_CREATED'
  | 'WEEKLY_REPORT_GENERATED'
  | 'PM_CHAT_MESSAGE_SENT'
  | 'DECISION_DRAFTED'
  | 'DECISION_APPLIED'
  | 'DECISION_SKIPPED'
  | 'DECISION_AUDITED'
  | 'SCHEDULER_RUN_COMPLETED';

export interface AgentMessage<TPayload = unknown> {
  messageId: string;
  correlationId: string;
  type: AgentMessageType;
  sourceAgent: AgentName;
  targetAgents: AgentName[];
  projectId: string;
  payload: TPayload;
  timestamp: string;
  requiresDecision?: boolean;
  decisionId?: string;
}

export interface Project {
  projectId: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  employeeId: string;
  projectId: string;
  employeeName: string;
  role?: string;
  currentWorkload: WorkloadLevel;
  updatedAt: string;
}

export interface DailyUpdate {
  updateId: string;
  projectId: string;
  correlationId: string;
  employeeId: string;
  employeeName: string;
  taskId?: string;
  taskTitle?: string;
  status?: 'not_started' | 'in_progress' | 'blocked' | 'done';
  yesterday?: string;
  today?: string;
  blockers: string[];
  workload: WorkloadLevel;
  needsHelp: boolean;
  dueDate?: string;
  submittedAt: string;
  createdAt: string;
}

export interface DecisionRequest {
  decisionId: string;
  projectId: string;
  correlationId: string;
  category: 'risk_escalation' | 'resource_rebalance' | 'general_guidance';
  status: DecisionStatus;
  lifecycleStage: DecisionLifecycleStage;
  question: string;
  options: DecisionValue[];
  requestedBy: AgentName;
  origin: 'workflow' | 'pm_chat' | 'scheduler';
  context: Record<string, unknown>;
  requestedAt: string;
  updatedAt: string;
  appliedAt?: string;
  auditedAt?: string;
}

export interface DecisionRecord {
  decisionId: string;
  projectId: string;
  correlationId: string;
  decision: DecisionValue;
  decidedBy: string;
  comment?: string;
  decidedAt: string;
  lifecycleStage: DecisionLifecycleStage;
}

export interface RiskAlert {
  riskId: string;
  projectId: string;
  correlationId: string;
  employeeId: string;
  employeeName: string;
  riskTitle: string;
  severity: RiskSeverity;
  reason: string;
  recommendedAction: string;
  requiresDecision: boolean;
  decisionId?: string;
  status: DecisionStatus;
  createdAt: string;
}

export interface ResourceRecommendation {
  recommendationId: string;
  projectId: string;
  correlationId: string;
  issue: string;
  overloadedEmployeeId: string;
  overloadedEmployeeName: string;
  availableEmployeeId: string;
  availableEmployeeName: string;
  suggestedAction: string;
  impact: string;
  requiresDecision: boolean;
  decisionId?: string;
  status: DecisionStatus;
  createdAt: string;
}

export interface ReportEntry {
  entryId: string;
  projectId: string;
  correlationId: string;
  sourceMessageId: string;
  messageType: AgentMessageType;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface WeeklyReport {
  reportId: string;
  projectId: string;
  generatedAt: string;
  markdown: string;
  progress: string[];
  blockers: string[];
  risks: string[];
  workload: string[];
  decisions: string[];
  nextSteps: string[];
}

export type PMChatIntent = 'ask' | 'propose' | 'decide' | 'execute';

export interface PMChatMessage {
  messageId: string;
  threadId: string;
  projectId: string;
  role: 'pm' | 'agent' | 'system';
  agentName?: AgentName;
  intent?: PMChatIntent;
  content: string;
  decisionId?: string;
  createdAt: string;
}

export interface PMChatThread {
  threadId: string;
  projectId: string;
  title: string;
  targetAgent: AgentName;
  status: 'open' | 'decision_drafted' | 'decision_pending' | 'closed';
  decisionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulerState {
  enabled: boolean;
  dailyCheckinTime: string;
  weeklyReportDay: string;
  weeklyReportTime: string;
  lastDailyRunAt?: string;
  lastWeeklyRunAt?: string;
  lastRunSummary?: string;
}

export interface AgentPerformanceMetric {
  agentName: AgentName;
  messagesSent: number;
  messagesReceived: number;
  decisionsRequested: number;
  reportEntriesCreated: number;
  lastActivityAt?: string;
}

export interface ProjectAnalytics {
  projectId: string;
  generatedAt: string;
  totals: {
    employees: number;
    updates: number;
    agentMessages: number;
    risks: number;
    recommendations: number;
    decisions: number;
    reportEntries: number;
  };
  decisionStatusCounts: Record<DecisionStatus, number>;
  workloadCounts: Record<WorkloadLevel, number>;
  riskSeverityCounts: Record<RiskSeverity, number>;
  agentPerformance: AgentPerformanceMetric[];
}

export interface SubmitUpdateRequest {
  projectId: string;
  correlationId?: string;
  employeeId: string;
  employeeName: string;
  yesterday?: string;
  today?: string;
  blockers?: string | string[] | null;
  workload: WorkloadLevel;
  needsHelp?: boolean | null;
  taskId?: string;
  taskTitle?: string;
  status?: 'not_started' | 'in_progress' | 'blocked' | 'done';
  dueDate?: string;
  submittedAt?: string;
}

export interface SubmitUpdateResponse {
  updateId: string;
  correlationId: string;
  eventsCreated: AgentMessageType[];
  pendingApprovals: Array<{
    decisionId: string;
    type: DecisionRequest['category'];
    title: string;
    question: string;
  }>;
}

export interface ProjectStateSnapshot {
  project: Project | null;
  employees: Employee[];
  updates: DailyUpdate[];
  agentMessages: AgentMessage[];
  risks: RiskAlert[];
  resourceRecommendations: ResourceRecommendation[];
  decisionsAll: DecisionRequest[];
  decisionsPending: DecisionRequest[];
  decisionsHistory: DecisionRecord[];
  reportEntries: ReportEntry[];
  weeklyReport: WeeklyReport | null;
  pmChatThreads: PMChatThread[];
  pmChatMessages: PMChatMessage[];
  scheduler: SchedulerState;
}
