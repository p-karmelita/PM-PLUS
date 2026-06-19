import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyDecision,
  auditDecision,
  confirmPMChatDraft,
  generateWeeklyReport,
  getAgentMessages,
  getIntegrationStatus,
  getPMChat,
  getPendingDecisions,
  getProjectAnalytics,
  getProjectState,
  getRecommendations,
  getRisks,
  getSchedulerStatus,
  runFullScenario,
  runSchedulerDaily,
  runSchedulerWeekly,
  seedTeam,
  sendPMChatMessage,
  sendIntegrationNotification,
  setSchedulerEnabled,
  skipDecision,
  startDailyCheckin,
  submitDecision,
  submitProjectUpdate,
} from './api';
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

const DEFAULT_PROJECT = 'project-alpha';
const CHAT_AGENTS: BackboneAgentName[] = ['orchestrator', 'collector', 'risk_analyzer', 'resource_balancer', 'reporter'];
const CHAT_INTENTS: BackbonePMChatIntent[] = ['ask', 'propose', 'decide', 'execute'];

function Badge({ text, tone }: { text: string; tone: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const classes =
    tone === 'good'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'warn'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : tone === 'bad'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-slate-50 text-slate-700 border-slate-200';
  return <span className={`text-[11px] px-2 py-0.5 border rounded-full font-medium ${classes}`}>{text}</span>;
}

function isoTime(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function statusTone(status: string): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'approved' || status === 'applied' || status === 'audited') return 'good';
  if (status === 'rejected' || status === 'skipped') return 'bad';
  if (status === 'pending' || status === 'pending_pm' || status === 'decision_pending') return 'warn';
  return 'neutral';
}

function csvEscape(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [projectId, setProjectId] = useState(DEFAULT_PROJECT);
  const [state, setState] = useState<BackboneProjectState | null>(null);
  const [messages, setMessages] = useState<BackboneAgentMessage[]>([]);
  const [decisions, setDecisions] = useState<BackboneDecisionRequest[]>([]);
  const [risks, setRisks] = useState<BackboneRisk[]>([]);
  const [recommendations, setRecommendations] = useState<BackboneRecommendation[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<BackboneWeeklyReport | null>(null);
  const [chatThreads, setChatThreads] = useState<BackbonePMChatThread[]>([]);
  const [chatMessages, setChatMessages] = useState<BackbonePMChatMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [scheduler, setScheduler] = useState<BackboneSchedulerState | null>(null);
  const [analytics, setAnalytics] = useState<BackboneProjectAnalytics | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<Record<'slack' | 'teams', boolean>>({
    slack: false,
    teams: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [lastCheckin, setLastCheckin] = useState<string[] | null>(null);
  const [lifecycleNotes, setLifecycleNotes] = useState<Record<string, string>>({});
  const [logSearch, setLogSearch] = useState('');
  const [logAgent, setLogAgent] = useState<'all' | BackboneAgentName>('all');
  const [logType, setLogType] = useState('all');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const notifiedIds = useRef<Set<string>>(new Set());

  const [updateForm, setUpdateForm] = useState({
    employeeId: 'alice',
    employeeName: 'Alice',
    yesterday: '',
    today: '',
    blockers: '',
    workload: 'normal' as 'light' | 'normal' | 'heavy',
    needsHelp: false,
  });

  const [chatForm, setChatForm] = useState({
    targetAgent: 'resource_balancer' as BackboneAgentName,
    intent: 'propose' as BackbonePMChatIntent,
    message: 'Propose a resource rebalance for current workload risk.',
  });

  function maybeNotify(nextDecisions: BackboneDecisionRequest[], nextRisks: BackboneRisk[]) {
    if (!notificationsEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    for (const decision of nextDecisions) {
      const key = `decision:${decision.decisionId}`;
      if (notifiedIds.current.has(key)) continue;
      notifiedIds.current.add(key);
      new Notification('PM PLUS decision required', {
        body: decision.question,
      });
    }

    for (const risk of nextRisks) {
      if (risk.severity !== 'high' && risk.severity !== 'critical') continue;
      const key = `risk:${risk.riskId}`;
      if (notifiedIds.current.has(key)) continue;
      notifiedIds.current.add(key);
      new Notification(`PM PLUS ${risk.severity} risk`, {
        body: risk.riskTitle,
      });
    }
  }

  const refresh = useCallback(async () => {
    try {
      const [
        projectState,
        projectMessages,
        pendingDecisions,
        projectRisks,
        projectRecommendations,
        chat,
        schedulerState,
        projectAnalytics,
        integrations,
      ] =
        await Promise.all([
          getProjectState(projectId),
          getAgentMessages(projectId),
          getPendingDecisions(projectId),
          getRisks(projectId),
          getRecommendations(projectId),
          getPMChat(projectId),
          getSchedulerStatus(),
          getProjectAnalytics(projectId),
          getIntegrationStatus(),
        ]);

      setState(projectState);
      setMessages(projectMessages.messages);
      setDecisions(pendingDecisions.decisions);
      setRisks(projectRisks.risks);
      setRecommendations(projectRecommendations.recommendations);
      setWeeklyReport(projectState.weeklyReport);
      setChatThreads(chat.threads);
      setChatMessages(chat.messages);
      setScheduler(schedulerState);
      setAnalytics(projectAnalytics);
      setIntegrationStatus(integrations);
      if (!selectedThreadId && chat.threads.length > 0) {
        setSelectedThreadId(chat.threads[0].threadId);
      }
      maybeNotify(pendingDecisions.decisions, projectRisks.risks);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load project state';
      setError(message);
    }
  }, [projectId, selectedThreadId, notificationsEnabled]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function runAction<T>(key: string, action: () => Promise<T>): Promise<T | null> {
    setActionBusy(key);
    try {
      const result = await action();
      await refresh();
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Action failed';
      setError(message);
      return null;
    } finally {
      setActionBusy(null);
    }
  }

  async function onSeedTeam() {
    await runAction('seed', () => seedTeam(projectId));
  }

  async function onStartCheckin() {
    const result = await runAction('checkin', () => startDailyCheckin(projectId));
    if (result) {
      setLastCheckin(result.questions);
    }
  }

  async function onRunScenario() {
    await runAction('scenario', () => runFullScenario(projectId));
  }

  async function onGenerateReport() {
    const report = await runAction('report', () => generateWeeklyReport(projectId));
    if (report) setWeeklyReport(report);
  }

  async function onSubmitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction('update', () =>
      submitProjectUpdate({
        projectId,
        employeeId: updateForm.employeeId.trim(),
        employeeName: updateForm.employeeName.trim(),
        yesterday: updateForm.yesterday.trim() || undefined,
        today: updateForm.today.trim() || undefined,
        blockers: updateForm.blockers.trim() ? updateForm.blockers.split(';') : [],
        workload: updateForm.workload,
        needsHelp: updateForm.needsHelp,
      })
    );
  }

  async function onDecision(decisionId: string, decision: 'approve' | 'reject') {
    await runAction(`decision-${decisionId}`, () =>
      submitDecision({
        projectId,
        decisionId,
        decision,
        decidedBy: 'pm-user',
        comment: decisionNotes[decisionId]?.trim() || undefined,
      })
    );
  }

  async function onApplyDecision(decisionId: string) {
    await runAction(`apply-${decisionId}`, () =>
      applyDecision({
        projectId,
        decisionId,
        appliedBy: 'pm-user',
        note: lifecycleNotes[decisionId]?.trim() || undefined,
      })
    );
  }

  async function onSkipDecision(decisionId: string) {
    await runAction(`skip-${decisionId}`, () =>
      skipDecision({
        projectId,
        decisionId,
        skippedBy: 'pm-user',
        note: lifecycleNotes[decisionId]?.trim() || undefined,
      })
    );
  }

  async function onAuditDecision(decisionId: string) {
    await runAction(`audit-${decisionId}`, () =>
      auditDecision({
        projectId,
        decisionId,
        auditedBy: 'pm-user',
        note: lifecycleNotes[decisionId]?.trim() || undefined,
      })
    );
  }

  async function onSendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatForm.message.trim();
    if (!message) return;
    const result = await runAction('pm-chat', () =>
      sendPMChatMessage({
        projectId,
        threadId: selectedThreadId || undefined,
        targetAgent: chatForm.targetAgent,
        intent: chatForm.intent,
        message,
      })
    );
    if (result) {
      setSelectedThreadId(result.thread.threadId);
      setChatForm((prev) => ({ ...prev, message: '' }));
    }
  }

  async function onConfirmDraft(threadId: string) {
    await runAction(`confirm-${threadId}`, () => confirmPMChatDraft(projectId, threadId));
  }

  async function onToggleScheduler() {
    await runAction('scheduler-toggle', () => setSchedulerEnabled(!scheduler?.enabled));
  }

  async function onRunDailyScheduler() {
    await runAction('scheduler-daily', () => runSchedulerDaily(projectId));
  }

  async function onRunWeeklyScheduler() {
    await runAction('scheduler-weekly', () => runSchedulerWeekly(projectId));
  }

  async function onEnableNotifications() {
    if (typeof Notification === 'undefined') {
      setError('Browser notifications are not supported in this browser');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    if (permission !== 'granted') {
      setError('Browser notification permission was not granted');
    }
  }

  function onExportWeeklyCsv() {
    window.location.href = `/exports/weekly/${encodeURIComponent(projectId)}.csv`;
  }

  function onExportWeeklyPdf() {
    window.location.href = `/exports/weekly/${encodeURIComponent(projectId)}.pdf`;
  }

  function onExportFilteredEventsCsv() {
    const rows = [
      ['timestamp', 'type', 'sourceAgent', 'targetAgents', 'correlationId', 'decisionId', 'payload'],
      ...filteredMessages.map((message) => [
        message.timestamp,
        message.type,
        message.sourceAgent,
        message.targetAgents.join(';'),
        message.correlationId,
        message.decisionId || '',
        JSON.stringify(message.payload),
      ]),
    ];
    downloadText(
      `${projectId}-agent-events.csv`,
      rows.map((row) => row.map(csvEscape).join(',')).join('\n'),
      'text/csv;charset=utf-8'
    );
  }

  function onPrintWeeklyReport() {
    if (!weeklyReport) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${projectId} weekly report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            pre { white-space: pre-wrap; font-size: 13px; line-height: 1.5; }
          </style>
        </head>
        <body><pre>${weeklyReport.markdown.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] || char))}</pre></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  async function onSendIntegrationDigest() {
    const summary = analytics
      ? `${analytics.totals.risks} risks, ${analytics.totals.decisions} decisions, ${analytics.totals.agentMessages} agent messages.`
      : `Project ${projectId} digest is ready.`;
    await runAction('integrations-digest', () =>
      sendIntegrationNotification({
        projectId,
        title: 'PM PLUS project digest',
        message: summary,
        channels: ['all'],
      })
    );
  }

  function renderDecisionControls(decision: BackboneDecisionRequest) {
    const note = lifecycleNotes[decision.decisionId] || decisionNotes[decision.decisionId] || '';
    const canDecide = decision.status === 'pending' || decision.status === 'pending_pm';
    const canApplyOrSkip = decision.status === 'approved';
    const canAudit = decision.status === 'applied' || decision.status === 'skipped';
    const isTerminal = decision.status === 'rejected' || decision.status === 'audited';

    if (isTerminal) {
      return <div className="text-xs text-slate-500 mt-2">No further PM action required.</div>;
    }

    return (
      <>
        <textarea
          value={note}
          onChange={(e) => {
            setDecisionNotes((prev) => ({ ...prev, [decision.decisionId]: e.target.value }));
            setLifecycleNotes((prev) => ({ ...prev, [decision.decisionId]: e.target.value }));
          }}
          rows={2}
          placeholder="PM note"
          className="mt-2 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {canDecide && (
            <>
              <button
                onClick={() => onDecision(decision.decisionId, 'approve')}
                disabled={actionBusy !== null}
                className="rounded bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 text-xs font-semibold"
              >
                Approve
              </button>
              <button
                onClick={() => onDecision(decision.decisionId, 'reject')}
                disabled={actionBusy !== null}
                className="rounded bg-red-600 hover:bg-red-500 text-white px-2.5 py-1.5 text-xs font-semibold"
              >
                Reject
              </button>
            </>
          )}
          {canApplyOrSkip && (
            <>
              <button
                onClick={() => onApplyDecision(decision.decisionId)}
                disabled={actionBusy !== null}
                className="rounded bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 text-xs font-semibold"
              >
                Apply
              </button>
              <button
                onClick={() => onSkipDecision(decision.decisionId)}
                disabled={actionBusy !== null}
                className="rounded bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1.5 text-xs font-semibold"
              >
                Skip
              </button>
            </>
          )}
          {canAudit && (
            <button
              onClick={() => onAuditDecision(decision.decisionId)}
              disabled={actionBusy !== null}
              className="rounded bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 text-xs font-semibold"
            >
              Audit
            </button>
          )}
        </div>
      </>
    );
  }

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [messages]
  );

  const logAgents = useMemo(
    () =>
      Array.from(
        new Set(messages.flatMap((message) => [message.sourceAgent, ...message.targetAgents]))
      ).sort() as BackboneAgentName[],
    [messages]
  );

  const logTypes = useMemo(
    () => Array.from(new Set(messages.map((message) => message.type))).sort(),
    [messages]
  );

  const filteredMessages = useMemo(() => {
    const query = logSearch.trim().toLowerCase();
    return sortedMessages.filter((message) => {
      const matchesAgent =
        logAgent === 'all' || message.sourceAgent === logAgent || message.targetAgents.includes(logAgent);
      const matchesType = logType === 'all' || message.type === logType;
      const haystack = `${message.type} ${message.sourceAgent} ${message.targetAgents.join(' ')} ${message.correlationId} ${JSON.stringify(message.payload)}`.toLowerCase();
      return matchesAgent && matchesType && (!query || haystack.includes(query));
    });
  }, [sortedMessages, logSearch, logAgent, logType]);

  const sortedDecisions = useMemo(() => {
    const all = state?.decisionsAll?.length ? state.decisionsAll : decisions;
    return [...all].sort((a, b) => new Date(b.updatedAt || b.requestedAt).getTime() - new Date(a.updatedAt || a.requestedAt).getTime());
  }, [state?.decisionsAll, decisions]);

  const selectedThread = useMemo(
    () => chatThreads.find((thread) => thread.threadId === selectedThreadId) || chatThreads[0] || null,
    [chatThreads, selectedThreadId]
  );

  const visibleChatMessages = useMemo(() => {
    const activeThreadId = selectedThread?.threadId;
    return chatMessages
      .filter((message) => !activeThreadId || message.threadId === activeThreadId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [chatMessages, selectedThread]);

  const maxAgentMessages = Math.max(
    1,
    ...(analytics?.agentPerformance.map((metric) => metric.messagesSent + metric.messagesReceived) || [1])
  );

  const decisionChartEntries = useMemo(
    () => Object.entries(analytics?.decisionStatusCounts || {}).filter(([, count]) => count > 0),
    [analytics]
  );

  const maxDecisionCount = Math.max(1, ...decisionChartEntries.map(([, count]) => count));

  const healthText = loading
    ? 'Loading…'
    : error
    ? 'Error'
    : state?.project
    ? `Active (${state.project.status})`
    : 'Not seeded';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-[1500px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">PM PLUS Backbone Console</h1>
            <p className="text-xs text-slate-500 mt-1">
              Collector → Risk Analyzer ↔ Reporter ↔ Resource Balancer → PM Decisions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Project</label>
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
            />
            <Badge
              text={healthText}
              tone={error ? 'bad' : state?.project ? 'good' : 'neutral'}
            />
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-6 py-5 grid gap-4">
        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <section className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-3">
          <button
            onClick={onSeedTeam}
            disabled={actionBusy !== null}
            className="rounded border border-slate-300 bg-white hover:bg-slate-50 px-4 py-3 text-sm font-semibold text-left"
          >
            Seed Team
            <div className="text-xs text-slate-500 font-normal mt-1">Create demo project and employees</div>
          </button>
          <button
            onClick={onStartCheckin}
            disabled={actionBusy !== null}
            className="rounded border border-slate-300 bg-white hover:bg-slate-50 px-4 py-3 text-sm font-semibold text-left"
          >
            Start Daily Check-in
            <div className="text-xs text-slate-500 font-normal mt-1">Emit CHECKIN_REQUESTED</div>
          </button>
          <button
            onClick={onRunScenario}
            disabled={actionBusy !== null}
            className="rounded border border-slate-900 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 text-sm font-semibold text-left"
          >
            Run Full Scenario
            <div className="text-xs text-slate-300 font-normal mt-1">Seed → Updates → Decisions → Weekly report</div>
          </button>
          <button
            onClick={onGenerateReport}
            disabled={actionBusy !== null}
            className="rounded border border-emerald-600 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 text-sm font-semibold text-left"
          >
            Generate Weekly Report
            <div className="text-xs text-emerald-100 font-normal mt-1">Emit WEEKLY_REPORT_GENERATED</div>
          </button>
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Production Controls</div>
              <div className="text-xs text-slate-500 mt-1">
                Slack {integrationStatus.slack ? 'configured' : 'not configured'} · Teams{' '}
                {integrationStatus.teams ? 'configured' : 'not configured'} · Browser notifications{' '}
                {notificationsEnabled ? 'enabled' : 'disabled'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onEnableNotifications}
                className="rounded border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold"
              >
                Enable Notifications
              </button>
              <button
                onClick={onSendIntegrationDigest}
                disabled={actionBusy !== null}
                className="rounded border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold"
              >
                Send Webhook Digest
              </button>
              <button
                onClick={onExportWeeklyCsv}
                className="rounded bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 text-xs font-semibold"
              >
                Export Report CSV
              </button>
              <button
                onClick={onExportWeeklyPdf}
                className="rounded bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 text-xs font-semibold"
              >
                Export Report PDF
              </button>
            </div>
          </div>
        </section>

        {lastCheckin && (
          <section className="rounded border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold mb-2">Daily Questions</div>
            <ul className="text-sm text-slate-600 space-y-1">
              {lastCheckin.map((question) => (
                <li key={question}>• {question}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="grid lg:grid-cols-2 grid-cols-1 gap-4">
          <form onSubmit={onSubmitUpdate} className="rounded border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold mb-3">Submit Employee Update</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                value={updateForm.employeeId}
                onChange={(e) => setUpdateForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                placeholder="employeeId"
                className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              />
              <input
                value={updateForm.employeeName}
                onChange={(e) => setUpdateForm((prev) => ({ ...prev, employeeName: e.target.value }))}
                placeholder="employeeName"
                className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <textarea
                value={updateForm.yesterday}
                onChange={(e) => setUpdateForm((prev) => ({ ...prev, yesterday: e.target.value }))}
                placeholder="Yesterday"
                rows={2}
                className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              />
              <textarea
                value={updateForm.today}
                onChange={(e) => setUpdateForm((prev) => ({ ...prev, today: e.target.value }))}
                placeholder="Today"
                rows={2}
                className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
              <input
                value={updateForm.blockers}
                onChange={(e) => setUpdateForm((prev) => ({ ...prev, blockers: e.target.value }))}
                placeholder="Blockers (separate with ;)"
                className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              />
              <select
                value={updateForm.workload}
                onChange={(e) =>
                  setUpdateForm((prev) => ({
                    ...prev,
                    workload: e.target.value as 'light' | 'normal' | 'heavy',
                  }))
                }
                className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
              >
                <option value="light">light</option>
                <option value="normal">normal</option>
                <option value="heavy">heavy</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
              <input
                type="checkbox"
                checked={updateForm.needsHelp}
                onChange={(e) => setUpdateForm((prev) => ({ ...prev, needsHelp: e.target.checked }))}
              />
              Needs help
            </label>
            <button
              type="submit"
              disabled={actionBusy !== null}
              className="rounded bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 text-sm font-semibold"
            >
              Submit Update
            </button>
          </form>

          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-semibold">Decision Lifecycle ({sortedDecisions.length})</div>
              <Badge text={`${decisions.length} pending`} tone={decisions.length ? 'warn' : 'neutral'} />
            </div>
            {sortedDecisions.length === 0 ? (
              <div className="text-sm text-slate-500">No decision requests yet.</div>
            ) : (
              <div className="space-y-3 max-h-[430px] overflow-auto pr-1">
                {sortedDecisions.map((decision) => (
                  <div key={decision.decisionId} className="border border-slate-200 rounded p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {decision.category} · {decision.origin}
                      </div>
                      <Badge text={decision.status} tone={statusTone(decision.status)} />
                    </div>
                    <div className="text-sm font-medium text-slate-800">{decision.question}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>{decision.requestedBy}</span>
                      <span>{decision.lifecycleStage}</span>
                      <span>{isoTime(decision.updatedAt || decision.requestedAt)}</span>
                    </div>
                    {renderDecisionControls(decision)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="grid lg:grid-cols-[1.35fr_0.65fr] grid-cols-1 gap-4">
          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-semibold">PM Decision Chat</div>
              <button
                onClick={() => setSelectedThreadId(null)}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50"
              >
                New Thread
              </button>
            </div>

            <div className="grid md:grid-cols-[220px_1fr] gap-3">
              <div className="border border-slate-200 rounded p-2 max-h-[340px] overflow-auto">
                {chatThreads.length === 0 ? (
                  <div className="text-sm text-slate-500 p-1">No chat threads.</div>
                ) : (
                  <div className="space-y-2">
                    {chatThreads.map((thread) => (
                      <button
                        key={thread.threadId}
                        onClick={() => setSelectedThreadId(thread.threadId)}
                        className={`w-full text-left rounded border px-2 py-2 ${
                          selectedThread?.threadId === thread.threadId
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-semibold text-slate-800 truncate">{thread.title}</div>
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <span className="text-[11px] text-slate-500">{thread.targetAgent}</span>
                          <Badge text={thread.status} tone={statusTone(thread.status)} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <div className="border border-slate-200 rounded p-3 max-h-[260px] overflow-auto bg-slate-50">
                  {visibleChatMessages.length === 0 ? (
                    <div className="text-sm text-slate-500">Send a message to start a PM-agent thread.</div>
                  ) : (
                    <div className="space-y-2">
                      {visibleChatMessages.map((message) => (
                        <div
                          key={message.messageId}
                          className={`rounded border px-3 py-2 ${
                            message.role === 'pm'
                              ? 'bg-white border-slate-200 ml-8'
                              : 'bg-blue-50 border-blue-100 mr-8'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="text-xs font-semibold text-slate-600">
                              {message.role === 'pm' ? 'PM' : message.agentName || 'agent'}
                            </div>
                            <div className="text-[11px] text-slate-400">{isoTime(message.createdAt)}</div>
                          </div>
                          <div className="text-sm text-slate-800 whitespace-pre-wrap">{message.content}</div>
                          {message.decisionId && (
                            <div className="text-[11px] text-slate-500 mt-1">decision: {message.decisionId}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedThread?.status === 'decision_drafted' && selectedThread.decisionId && (
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-amber-900">Decision draft ready</div>
                      <div className="text-xs text-amber-700">{selectedThread.decisionId}</div>
                    </div>
                    <button
                      onClick={() => onConfirmDraft(selectedThread.threadId)}
                      disabled={actionBusy !== null}
                      className="rounded bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 text-xs font-semibold"
                    >
                      Confirm Draft
                    </button>
                  </div>
                )}

                <form onSubmit={onSendChatMessage} className="grid gap-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <select
                      value={chatForm.targetAgent}
                      onChange={(e) =>
                        setChatForm((prev) => ({ ...prev, targetAgent: e.target.value as BackboneAgentName }))
                      }
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                    >
                      {CHAT_AGENTS.map((agent) => (
                        <option key={agent} value={agent}>
                          {agent}
                        </option>
                      ))}
                    </select>
                    <select
                      value={chatForm.intent}
                      onChange={(e) =>
                        setChatForm((prev) => ({ ...prev, intent: e.target.value as BackbonePMChatIntent }))
                      }
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                    >
                      {CHAT_INTENTS.map((intent) => (
                        <option key={intent} value={intent}>
                          {intent}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={chatForm.message}
                    onChange={(e) => setChatForm((prev) => ({ ...prev, message: e.target.value }))}
                    rows={3}
                    placeholder="Message an agent"
                    className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={actionBusy !== null || !chatForm.message.trim()}
                    className="rounded bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 text-sm font-semibold justify-self-start"
                  >
                    Send to Agent
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-semibold">Scheduler</div>
              <Badge text={scheduler?.enabled ? 'enabled' : 'disabled'} tone={scheduler?.enabled ? 'good' : 'neutral'} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-slate-200 rounded p-2">
                <div className="text-xs text-slate-500">Daily</div>
                <div className="font-semibold">{scheduler?.dailyCheckinTime || '09:00'}</div>
                <div className="text-[11px] text-slate-500 mt-1">{isoTime(scheduler?.lastDailyRunAt)}</div>
              </div>
              <div className="border border-slate-200 rounded p-2">
                <div className="text-xs text-slate-500">Weekly</div>
                <div className="font-semibold">
                  {scheduler?.weeklyReportDay || 'friday'} {scheduler?.weeklyReportTime || '16:00'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{isoTime(scheduler?.lastWeeklyRunAt)}</div>
              </div>
            </div>
            <div className="text-xs text-slate-600 mt-3 min-h-8">
              {scheduler?.lastRunSummary || 'No scheduled run recorded.'}
            </div>
            <div className="mt-3 grid gap-2">
              <button
                onClick={onToggleScheduler}
                disabled={actionBusy !== null}
                className="rounded border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-semibold"
              >
                {scheduler?.enabled ? 'Disable Scheduler' : 'Enable Scheduler'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRunDailyScheduler}
                  disabled={actionBusy !== null}
                  className="rounded bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 text-sm font-semibold"
                >
                  Run Daily
                </button>
                <button
                  onClick={onRunWeeklyScheduler}
                  disabled={actionBusy !== null}
                  className="rounded bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-sm font-semibold"
                >
                  Run Weekly
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-[1.2fr_0.8fr] grid-cols-1 gap-4">
          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-semibold">AI Agent Views</div>
              <div className="text-xs text-slate-500">{analytics ? isoTime(analytics.generatedAt) : '—'}</div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {(analytics?.agentPerformance || [])
                .filter((metric) => metric.agentName !== 'pm' && metric.agentName !== 'orchestrator')
                .map((metric) => {
                  const total = metric.messagesSent + metric.messagesReceived;
                  return (
                    <div key={metric.agentName} className="border border-slate-200 rounded p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-sm font-semibold">{metric.agentName}</div>
                        <Badge text={metric.lastActivityAt ? 'active' : 'idle'} tone={metric.lastActivityAt ? 'good' : 'neutral'} />
                      </div>
                      <div className="h-2 bg-slate-100 rounded overflow-hidden mb-2">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${Math.max(4, (total / maxAgentMessages) * 100)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div>
                          <div className="font-semibold text-slate-900">{metric.messagesSent}</div>
                          <div>sent</div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{metric.messagesReceived}</div>
                          <div>received</div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{metric.decisionsRequested}</div>
                          <div>decisions</div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{metric.reportEntriesCreated}</div>
                          <div>memory entries</div>
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">{isoTime(metric.lastActivityAt)}</div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold mb-3">Project Charts</div>
            <div className="grid gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">Workload</div>
                <div className="space-y-2">
                  {(['light', 'normal', 'heavy'] as const).map((workload) => {
                    const count = analytics?.workloadCounts[workload] || 0;
                    const total = Math.max(1, analytics?.totals.employees || 0);
                    return (
                      <div key={workload} className="grid grid-cols-[58px_1fr_24px] items-center gap-2 text-xs">
                        <span>{workload}</span>
                        <div className="h-2 bg-slate-100 rounded overflow-hidden">
                          <div className="h-full bg-emerald-600" style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                        <span className="text-right text-slate-500">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">Decision Status</div>
                <div className="space-y-2">
                  {decisionChartEntries.length === 0 ? (
                    <div className="text-xs text-slate-500">No decisions yet.</div>
                  ) : (
                    decisionChartEntries.map(([status, count]) => (
                      <div key={status} className="grid grid-cols-[78px_1fr_24px] items-center gap-2 text-xs">
                        <span>{status}</span>
                        <div className="h-2 bg-slate-100 rounded overflow-hidden">
                          <div className="h-full bg-indigo-600" style={{ width: `${(count / maxDecisionCount) * 100}%` }} />
                        </div>
                        <span className="text-right text-slate-500">{count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 grid-cols-1 gap-4">
          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold mb-3">Team Workload</div>
            <div className="space-y-2">
              {(state?.employees || []).map((employee) => (
                <div key={employee.employeeId} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                  <div>
                    <div className="font-medium">{employee.employeeName}</div>
                    <div className="text-xs text-slate-500">{employee.role || 'Contributor'}</div>
                  </div>
                  <Badge
                    text={employee.currentWorkload}
                    tone={employee.currentWorkload === 'heavy' ? 'bad' : employee.currentWorkload === 'normal' ? 'warn' : 'good'}
                  />
                </div>
              ))}
              {(!state || state.employees.length === 0) && (
                <div className="text-sm text-slate-500">No employees loaded.</div>
              )}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold mb-3">Risk & Rebalance</div>
            <div className="space-y-2 max-h-[300px] overflow-auto pr-1">
              {risks.map((risk) => (
                <div key={risk.riskId} className="border border-slate-200 rounded p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium">{risk.riskTitle}</div>
                    <div className="flex items-center gap-1">
                      <Badge text={risk.severity} tone={risk.severity === 'high' || risk.severity === 'critical' ? 'bad' : 'warn'} />
                      <Badge text={risk.status} tone={statusTone(risk.status)} />
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">{risk.employeeName}</div>
                </div>
              ))}
              {recommendations.map((rec) => (
                <div key={rec.recommendationId} className="border border-slate-200 rounded p-2.5 bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{rec.suggestedAction}</div>
                    <Badge text={rec.status} tone={statusTone(rec.status)} />
                  </div>
                  <div className="text-xs text-slate-600 mt-1">{rec.impact}</div>
                </div>
              ))}
              {risks.length === 0 && recommendations.length === 0 && (
                <div className="text-sm text-slate-500">No risks or recommendations yet.</div>
              )}
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 grid-cols-1 gap-4">
          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-semibold">
                Agent Collaboration Log ({filteredMessages.length}/{messages.length})
              </div>
              <button
                onClick={onExportFilteredEventsCsv}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50"
              >
                Export Events CSV
              </button>
            </div>
            <div className="grid sm:grid-cols-[1fr_150px_170px] gap-2 mb-3">
              <input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search events"
                className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              />
              <select
                value={logAgent}
                onChange={(e) => setLogAgent(e.target.value as 'all' | BackboneAgentName)}
                className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
              >
                <option value="all">all agents</option>
                {logAgents.map((agent) => (
                  <option key={agent} value={agent}>
                    {agent}
                  </option>
                ))}
              </select>
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
              >
                <option value="all">all types</option>
                {logTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-[420px] overflow-auto pr-1 space-y-2">
              {filteredMessages.slice(0, 160).map((message) => (
                <div key={message.messageId} className="border border-slate-200 rounded p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-xs font-semibold text-slate-500">
                      {message.sourceAgent} → {message.targetAgents.join(', ') || '—'}
                    </div>
                    <div className="text-[11px] text-slate-400">{isoTime(message.timestamp)}</div>
                  </div>
                  <div className="text-sm font-medium text-slate-800">{message.type}</div>
                  <pre className="mt-1 text-[11px] text-slate-600 overflow-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(message.payload, null, 2)}
                  </pre>
                </div>
              ))}
              {filteredMessages.length === 0 && <div className="text-sm text-slate-500">No matching messages.</div>}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-semibold">
                Weekly Report {weeklyReport ? `(${isoTime(weeklyReport.generatedAt)})` : ''}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onExportWeeklyCsv}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50"
                >
                  CSV
                </button>
                <button
                  onClick={onExportWeeklyPdf}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50"
                >
                  PDF
                </button>
                <button
                  onClick={onPrintWeeklyReport}
                  disabled={!weeklyReport}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  Print
                </button>
              </div>
            </div>
            {weeklyReport ? (
              <pre className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded p-3 max-h-[420px] overflow-auto whitespace-pre-wrap">
                {weeklyReport.markdown}
              </pre>
            ) : (
              <div className="text-sm text-slate-500">
                Weekly report not generated yet. Use "Generate Weekly Report" or "Run Full Scenario".
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
