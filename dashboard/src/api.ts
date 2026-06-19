import type {
  BackboneAgentMessage,
  BackboneAgentName,
  BackboneDecisionRequest,
  BackbonePMChatIntent,
  BackbonePMChatMessage,
  BackbonePMChatThread,
  BackboneProjectAnalytics,
  BackboneProjectState,
  BackboneRecommendation,
  BackboneRisk,
  BackboneSchedulerState,
  BackboneWeeklyReport,
} from './types';

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && (data.error as string)) || `HTTP ${res.status}`);
  }
  return data as T;
}

async function getJSON<T>(path: string): Promise<T> {
  return requestJSON<T>(path, { method: 'GET' });
}

async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  return requestJSON<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

// ---- Legacy helpers kept for backward compatibility with existing components ----

export async function createSession(sessionId?: string): Promise<{ sessionId: string }> {
  return postJSON('/demo/session', { sessionId });
}

export async function runSimulation(sessionId: string): Promise<{ sessionId: string }> {
  return postJSON('/demo/simulate', { sessionId });
}

export async function triggerReal(
  sessionId: string
): Promise<{ sessionId: string; posted: Array<{ employee: string; status: number }> }> {
  return postJSON('/demo/trigger-real', { sessionId });
}

export interface WeeklySnapshot {
  period_days: number;
  total_events: number;
  total_check_ins: number;
  risk_flags: number;
  by_employee: Record<string, { checkIns: any[]; risks: any[] }>;
  events: any[];
}

export async function fetchWeeklySnapshot(): Promise<WeeklySnapshot> {
  return getJSON('/weekly-snapshot');
}

export interface ApprovalDecision {
  requestId: string;
  approved: boolean;
  reason?: string;
  flag_id?: string;
  pm_notes?: string;
}

export async function respondApproval(decision: ApprovalDecision): Promise<void> {
  await postJSON('/human/approval-response', decision);
}

// ---- Backbone MVP API ----

export async function seedTeam(projectId: string): Promise<{ projectId: string }> {
  return postJSON('/demo/seed-team', { projectId });
}

export async function startDailyCheckin(projectId: string): Promise<{
  projectId: string;
  correlationId: string;
  status: string;
  questions: string[];
}> {
  return postJSON('/demo/start-daily-checkin', { projectId });
}

export async function runFullScenario(projectId: string): Promise<{
  projectId: string;
  updatesProcessed: number;
  decisionsRecorded: number;
  reportId: string;
}> {
  return postJSON('/demo/run-full-scenario', { projectId });
}

export async function submitProjectUpdate(payload: {
  projectId: string;
  correlationId?: string;
  employeeId: string;
  employeeName: string;
  yesterday?: string;
  today?: string;
  blockers?: string | string[] | null;
  workload: 'light' | 'normal' | 'heavy';
  needsHelp?: boolean | null;
}): Promise<{
  updateId: string;
  correlationId: string;
  eventsCreated: string[];
  pendingApprovals: Array<{ decisionId: string; type: string; title: string; question: string }>;
}> {
  return postJSON('/updates', payload);
}

export async function getProjectState(projectId: string): Promise<BackboneProjectState> {
  return getJSON(`/state/${encodeURIComponent(projectId)}`);
}

export async function getProjectAnalytics(projectId: string): Promise<BackboneProjectAnalytics> {
  return getJSON(`/analytics/${encodeURIComponent(projectId)}`);
}

export async function getProjectUpdates(projectId: string): Promise<{
  projectId: string;
  count: number;
  updates: BackboneProjectState['updates'];
}> {
  return getJSON(`/updates/${encodeURIComponent(projectId)}`);
}

export async function getAgentMessages(projectId: string): Promise<{
  projectId: string;
  count: number;
  messages: BackboneAgentMessage[];
}> {
  return getJSON(`/agent-messages/${encodeURIComponent(projectId)}`);
}

export async function getPendingDecisions(projectId: string): Promise<{
  projectId: string;
  count: number;
  decisions: BackboneDecisionRequest[];
}> {
  return getJSON(`/decisions/pending/${encodeURIComponent(projectId)}`);
}

export async function getDecisions(projectId: string): Promise<{
  projectId: string;
  count: number;
  decisions: BackboneDecisionRequest[];
}> {
  return getJSON(`/decisions/${encodeURIComponent(projectId)}`);
}

export async function submitDecision(payload: {
  projectId: string;
  decisionId: string;
  decision: 'approve' | 'reject';
  decidedBy: string;
  comment?: string;
}): Promise<{ status: string; eventsCreated: string[] }> {
  return postJSON('/decisions', payload);
}

export async function applyDecision(payload: {
  projectId: string;
  decisionId: string;
  appliedBy: string;
  note?: string;
}): Promise<{ status: string; eventsCreated: string[] }> {
  return postJSON(
    `/decisions/${encodeURIComponent(payload.projectId)}/${encodeURIComponent(payload.decisionId)}/apply`,
    {
      appliedBy: payload.appliedBy,
      note: payload.note,
    }
  );
}

export async function skipDecision(payload: {
  projectId: string;
  decisionId: string;
  skippedBy: string;
  note?: string;
}): Promise<{ status: string; eventsCreated: string[] }> {
  return postJSON(
    `/decisions/${encodeURIComponent(payload.projectId)}/${encodeURIComponent(payload.decisionId)}/skip`,
    {
      skippedBy: payload.skippedBy,
      note: payload.note,
    }
  );
}

export async function auditDecision(payload: {
  projectId: string;
  decisionId: string;
  auditedBy: string;
  note?: string;
}): Promise<{ status: string; eventsCreated: string[] }> {
  return postJSON(
    `/decisions/${encodeURIComponent(payload.projectId)}/${encodeURIComponent(payload.decisionId)}/audit`,
    {
      auditedBy: payload.auditedBy,
      note: payload.note,
    }
  );
}

export async function sendPMChatMessage(payload: {
  projectId: string;
  threadId?: string;
  targetAgent?: BackboneAgentName;
  intent?: BackbonePMChatIntent;
  message: string;
}): Promise<{
  thread: BackbonePMChatThread;
  messages: BackbonePMChatMessage[];
  decisionDraft?: BackboneDecisionRequest;
}> {
  return postJSON('/pm-chat/messages', payload);
}

export async function getPMChat(projectId: string, threadId?: string): Promise<{
  projectId: string;
  threads: BackbonePMChatThread[];
  messages: BackbonePMChatMessage[];
}> {
  const query = threadId ? `?threadId=${encodeURIComponent(threadId)}` : '';
  return getJSON(`/pm-chat/${encodeURIComponent(projectId)}${query}`);
}

export async function confirmPMChatDraft(projectId: string, threadId: string): Promise<{
  thread: BackbonePMChatThread;
  decision: BackboneDecisionRequest;
  event: BackboneAgentMessage;
}> {
  return postJSON(
    `/pm-chat/${encodeURIComponent(projectId)}/${encodeURIComponent(threadId)}/confirm`
  );
}

export async function getSchedulerStatus(): Promise<BackboneSchedulerState> {
  return getJSON('/scheduler/status');
}

export async function setSchedulerEnabled(enabled: boolean): Promise<BackboneSchedulerState> {
  return postJSON('/scheduler/enabled', { enabled });
}

export async function runSchedulerDaily(projectId: string): Promise<{
  projectId: string;
  correlationId: string;
  status: string;
}> {
  return postJSON('/scheduler/run-daily', { projectId });
}

export async function runSchedulerWeekly(projectId: string): Promise<{
  projectId: string;
  reportId: string;
  status: string;
}> {
  return postJSON('/scheduler/run-weekly', { projectId });
}

export async function sendIntegrationNotification(payload: {
  projectId: string;
  title: string;
  message: string;
  channels?: Array<'slack' | 'teams' | 'all'>;
}): Promise<{
  results: Array<{
    channel: 'slack' | 'teams';
    configured: boolean;
    delivered: boolean;
    statusCode?: number;
    error?: string;
  }>;
}> {
  return postJSON('/integrations/notify', payload);
}

export async function getIntegrationStatus(): Promise<Record<'slack' | 'teams', boolean>> {
  return getJSON('/integrations/status');
}

export async function getRisks(projectId: string): Promise<{
  projectId: string;
  count: number;
  risks: BackboneRisk[];
}> {
  return getJSON(`/risks/${encodeURIComponent(projectId)}`);
}

export async function getRecommendations(projectId: string): Promise<{
  projectId: string;
  count: number;
  recommendations: BackboneRecommendation[];
}> {
  return getJSON(`/resource-recommendations/${encodeURIComponent(projectId)}`);
}

export async function generateWeeklyReport(projectId: string): Promise<BackboneWeeklyReport> {
  return postJSON('/reports/weekly', { projectId });
}

export async function getWeeklyReport(projectId: string): Promise<BackboneWeeklyReport> {
  return getJSON(`/reports/weekly/${encodeURIComponent(projectId)}`);
}
