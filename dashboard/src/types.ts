// Mirrors the backend shapes in api/types.ts (only the fields the dashboard uses).

export type UpdateEventType =
  | 'connected'
  | 'state_change'
  | 'approval_request'
  | 'agent_message'
  | 'error';

export interface UpdateEvent {
  type: UpdateEventType;
  sessionId: string;
  data: any;
  timestamp: string;
}

export interface AgentMessage {
  messageId: string;
  sessionId: string;
  fromAgentId: string;
  toAgentId?: string;
  messageType: 'request' | 'response' | 'notification' | 'broadcast';
  content: Record<string, any>;
  sentAt: string;
}

export interface ApprovalRequest {
  requestId: string;
  sessionId: string;
  agentId: string;
  action: string;
  context: Record<string, any>;
  requestedAt: string;
}

export interface ProjectMetrics {
  sessionId: string;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  activeAgents: number;
  resourceUtilization: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: string;
}

// A normalized line for the live message log.
export interface LogLine {
  id: string;
  from: string;
  to?: string;
  text: string;
  kind: string; // messageType or event type
  loop?: string;
  timestamp: string;
}

// Derived health for an agent seen on the bus.
export interface AgentHealth {
  name: string;
  status: 'active' | 'waiting' | 'negotiating';
  lastActivity: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'idle';

export interface TeamMemberState {
  name: string;
  initials: string;
  role: string;
  avatarGradient: string;
  workload: number; // 0-100
  workloadLabel: 'overwhelmed' | 'heavy' | 'normal' | 'light' | 'unknown';
  blockers: string[];
  lastCheckIn: string | null;
  riskCount: number;
  riskSeverity: 'HIGH' | 'CRITICAL' | 'MEDIUM' | 'LOW' | null;
}

export type BackboneWorkload = 'light' | 'normal' | 'heavy';
export type BackboneAgentName =
  | 'collector'
  | 'risk_analyzer'
  | 'resource_balancer'
  | 'reporter'
  | 'orchestrator'
  | 'pm';
export type BackboneDecisionStatus =
  | 'draft'
  | 'pending'
  | 'pending_pm'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'skipped'
  | 'audited';
export type BackboneDecisionLifecycleStage =
  | 'draft'
  | 'pending_pm'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'skipped'
  | 'audited';
export type BackboneDecisionValue = 'approve' | 'reject';
export type BackbonePMChatIntent = 'ask' | 'propose' | 'decide' | 'execute';
export type BackboneRiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface BackboneEmployee {
  employeeId: string;
  projectId: string;
  employeeName: string;
  role?: string;
  currentWorkload: BackboneWorkload;
  updatedAt: string;
}

export interface BackboneDailyUpdate {
  updateId: string;
  projectId: string;
  correlationId: string;
  employeeId: string;
  employeeName: string;
  yesterday?: string;
  today?: string;
  blockers: string[];
  workload: BackboneWorkload;
  needsHelp: boolean;
  submittedAt: string;
  createdAt: string;
}

export interface BackboneDecisionRequest {
  decisionId: string;
  projectId: string;
  correlationId: string;
  category: 'risk_escalation' | 'resource_rebalance' | 'general_guidance';
  status: BackboneDecisionStatus;
  lifecycleStage: BackboneDecisionLifecycleStage;
  question: string;
  options: BackboneDecisionValue[];
  requestedBy: BackboneAgentName;
  origin: 'workflow' | 'pm_chat' | 'scheduler';
  context: Record<string, unknown>;
  requestedAt: string;
  updatedAt: string;
  appliedAt?: string;
  auditedAt?: string;
}

export interface BackboneRisk {
  riskId: string;
  projectId: string;
  correlationId: string;
  employeeId: string;
  employeeName: string;
  riskTitle: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  recommendedAction: string;
  requiresDecision: boolean;
  decisionId?: string;
  status: BackboneDecisionStatus;
  createdAt: string;
}

export interface BackboneRecommendation {
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
  status: BackboneDecisionStatus;
  createdAt: string;
}

export interface BackboneAgentMessage {
  messageId: string;
  correlationId: string;
  type: string;
  sourceAgent: string;
  targetAgents: string[];
  projectId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  requiresDecision?: boolean;
  decisionId?: string;
}

export interface BackboneWeeklyReport {
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

export interface BackbonePMChatThread {
  threadId: string;
  projectId: string;
  title: string;
  targetAgent: BackboneAgentName;
  status: 'open' | 'decision_drafted' | 'decision_pending' | 'closed';
  decisionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackbonePMChatMessage {
  messageId: string;
  threadId: string;
  projectId: string;
  role: 'pm' | 'agent' | 'system';
  agentName?: BackboneAgentName;
  intent?: BackbonePMChatIntent;
  content: string;
  decisionId?: string;
  createdAt: string;
}

export interface BackboneSchedulerState {
  enabled: boolean;
  dailyCheckinTime: string;
  weeklyReportDay: string;
  weeklyReportTime: string;
  lastDailyRunAt?: string;
  lastWeeklyRunAt?: string;
  lastRunSummary?: string;
}

export interface BackboneAgentPerformanceMetric {
  agentName: BackboneAgentName;
  messagesSent: number;
  messagesReceived: number;
  decisionsRequested: number;
  reportEntriesCreated: number;
  lastActivityAt?: string;
}

export interface BackboneProjectAnalytics {
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
  decisionStatusCounts: Record<BackboneDecisionStatus, number>;
  workloadCounts: Record<BackboneWorkload, number>;
  riskSeverityCounts: Record<BackboneRiskSeverity, number>;
  agentPerformance: BackboneAgentPerformanceMetric[];
}

export interface BackboneProjectState {
  project: {
    projectId: string;
    name: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  employees: BackboneEmployee[];
  updates: BackboneDailyUpdate[];
  agentMessages: BackboneAgentMessage[];
  risks: BackboneRisk[];
  resourceRecommendations: BackboneRecommendation[];
  decisionsAll: BackboneDecisionRequest[];
  decisionsPending: BackboneDecisionRequest[];
  decisionsHistory: Array<{
    decisionId: string;
    projectId: string;
    correlationId: string;
    decision: BackboneDecisionValue;
    decidedBy: string;
    comment?: string;
    decidedAt: string;
    lifecycleStage: BackboneDecisionLifecycleStage;
  }>;
  reportEntries: Array<{
    entryId: string;
    summary: string;
    messageType: string;
    createdAt: string;
  }>;
  weeklyReport: BackboneWeeklyReport | null;
  pmChatThreads: BackbonePMChatThread[];
  pmChatMessages: BackbonePMChatMessage[];
  scheduler: BackboneSchedulerState;
}
