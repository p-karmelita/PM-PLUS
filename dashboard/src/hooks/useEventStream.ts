import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentHealth,
  ApprovalRequest,
  ConnectionStatus,
  LogLine,
  ProjectMetrics,
  TeamMemberState,
  UpdateEvent
} from '../types';

const KNOWN_AGENTS = ['collector', 'risk_analyzer', 'reporter', 'resource_balancer', 'pm'];

const DEFAULT_TEAM: TeamMemberState[] = [
  { name: 'Alice Martinez', initials: 'AM', role: 'Frontend Engineer', avatarGradient: 'linear-gradient(135deg,#ef4444,#f97316)', workload: 0, workloadLabel: 'unknown', blockers: [], lastCheckIn: null, riskCount: 0, riskSeverity: null },
  { name: 'Bob Chen',       initials: 'BC', role: 'Backend Engineer',   avatarGradient: 'linear-gradient(135deg,#10b981,#06b6d4)', workload: 0, workloadLabel: 'unknown', blockers: [], lastCheckIn: null, riskCount: 0, riskSeverity: null },
  { name: 'Carol Davis',    initials: 'CD', role: 'QA Engineer',        avatarGradient: 'linear-gradient(135deg,#8b5cf6,#6366f1)', workload: 0, workloadLabel: 'unknown', blockers: [], lastCheckIn: null, riskCount: 0, riskSeverity: null },
  { name: 'Dave Wilson',    initials: 'DW', role: 'DevOps Engineer',    avatarGradient: 'linear-gradient(135deg,#f59e0b,#ef4444)', workload: 0, workloadLabel: 'unknown', blockers: [], lastCheckIn: null, riskCount: 0, riskSeverity: null },
];

function parseWorkload(val: unknown): { workload: number; workloadLabel: TeamMemberState['workloadLabel'] } {
  if (typeof val === 'string') {
    const s = val.toLowerCase();
    if (s === 'overwhelmed') return { workload: 100, workloadLabel: 'overwhelmed' };
    if (s === 'heavy')       return { workload: 78,  workloadLabel: 'heavy' };
    if (s === 'normal')      return { workload: 55,  workloadLabel: 'normal' };
    if (s === 'light')       return { workload: 25,  workloadLabel: 'light' };
  }
  if (typeof val === 'number') {
    if (val >= 8) return { workload: 100, workloadLabel: 'overwhelmed' };
    if (val >= 6) return { workload: 78,  workloadLabel: 'heavy' };
    if (val >= 4) return { workload: 55,  workloadLabel: 'normal' };
    if (val >= 1) return { workload: 25,  workloadLabel: 'light' };
  }
  return { workload: 0, workloadLabel: 'unknown' };
}

function messageToLogLine(data: any, fallbackTs: string): LogLine {
  const from = data.fromAgentId || data.source || data.agentId || 'system';
  const to = data.toAgentId;
  const content = data.content || {};
  const text =
    content.text ||
    content.status ||
    content.description ||
    (typeof content === 'string' ? content : JSON.stringify(content));
  return {
    id: data.messageId || data.dataId || `${from}-${fallbackTs}-${Math.random().toString(36).slice(2, 7)}`,
    from,
    to,
    text,
    kind: data.messageType || data.category || 'message',
    loop: content.loop,
    timestamp: data.sentAt || data.collectedAt || fallbackTs
  };
}

export interface StreamState {
  status: ConnectionStatus;
  log: LogLine[];
  approvals: ApprovalRequest[];
  agents: AgentHealth[];
  metrics: ProjectMetrics | null;
  teamHealth: TeamMemberState[];
}

export function useEventStream(sessionId: string | null) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [log, setLog] = useState<LogLine[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [agents, setAgents] = useState<AgentHealth[]>([]);
  const [teamHealth, setTeamHealth] = useState<TeamMemberState[]>(DEFAULT_TEAM);

  const teamMap = useRef<Map<string, TeamMemberState>>(
    new Map(DEFAULT_TEAM.map((m) => [m.name.split(' ')[0].toLowerCase(), { ...m }]))
  );

  const updateTeamMember = useCallback((name: string, patch: Partial<TeamMemberState>) => {
    const key = name.split(' ')[0].toLowerCase();
    const existing = teamMap.current.get(key);
    if (!existing) return;
    teamMap.current.set(key, { ...existing, ...patch });
    setTeamHealth(DEFAULT_TEAM.map((m) => teamMap.current.get(m.name.split(' ')[0].toLowerCase()) ?? m));
  }, []);

  // agent name -> health, kept in a ref so updates don't depend on stale state
  const agentMap = useRef<Map<string, AgentHealth>>(new Map());

  const touchAgent = useCallback((name: string, kind: string, ts: string) => {
    if (!name || name === 'system') return;
    const negotiating = kind === 'request';
    agentMap.current.set(name, {
      name,
      status: negotiating ? 'negotiating' : 'active',
      lastActivity: ts
    });
    setAgents(
      KNOWN_AGENTS.filter((n) => agentMap.current.has(n)).map((n) => agentMap.current.get(n)!)
    );
  }, []);

  const removeApproval = useCallback((requestId: string) => {
    setApprovals((prev) => prev.filter((a) => a.requestId !== requestId));
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    setStatus('connecting');
    const es = new EventSource(`/updates?sessionId=${encodeURIComponent(sessionId)}`);

    es.onopen = () => setStatus('connected');
    es.onerror = () => setStatus('reconnecting'); // EventSource auto-retries

    es.onmessage = (e) => {
      let evt: UpdateEvent;
      try {
        evt = JSON.parse(e.data);
      } catch {
        return;
      }

      switch (evt.type) {
        case 'connected':
          setStatus('connected');
          break;

        case 'agent_message': {
          const line = messageToLogLine(evt.data, evt.timestamp);
          setLog((prev) => [...prev, line]);
          touchAgent(line.from, line.kind, line.timestamp);
          if (line.to) touchAgent(line.to, line.kind, line.timestamp);
          // update team health if message carries a check-in payload
          const msgContent = evt.data?.content || {};
          if (msgContent.employee_name) {
            const wl = parseWorkload(msgContent.workload);
            const blockers = msgContent.blockers
              ? (Array.isArray(msgContent.blockers) ? msgContent.blockers : [String(msgContent.blockers)])
              : undefined;
            updateTeamMember(msgContent.employee_name, {
              lastCheckIn: line.timestamp,
              ...(wl.workloadLabel !== 'unknown' ? wl : {}),
              ...(blockers ? { blockers } : {})
            });
          }
          break;
        }

        case 'approval_request': {
          const req = evt.data as ApprovalRequest;
          setApprovals((prev) =>
            prev.some((a) => a.requestId === req.requestId) ? prev : [...prev, req]
          );
          setLog((prev) => [
            ...prev,
            {
              id: `appr-${req.requestId}`,
              from: req.agentId || 'risk_analyzer',
              to: 'pm',
              text: `⏸ Approval requested: ${req.action}`,
              kind: 'approval',
              loop: 'loop3',
              timestamp: req.requestedAt || evt.timestamp
            }
          ]);
          // update risk data for the employee named in the flag
          const ctx = req.context || {};
          if (ctx.employee_name) {
            updateTeamMember(ctx.employee_name, {
              riskSeverity: ctx.severity ?? null,
              riskCount: (teamMap.current.get(ctx.employee_name.split(' ')[0].toLowerCase())?.riskCount ?? 0) + 1
            });
          }
          break;
        }

        case 'state_change': {
          // metrics snapshots carry riskLevel; session snapshots carry agents[]
          if (evt.data && typeof evt.data.riskLevel === 'string') {
            setMetrics(evt.data as ProjectMetrics);
          }
          break;
        }

        case 'error': {
          setLog((prev) => [
            ...prev,
            {
              id: `err-${evt.timestamp}`,
              from: 'system',
              text: String(evt.data?.message || evt.data || 'error'),
              kind: 'error',
              timestamp: evt.timestamp
            }
          ]);
          break;
        }
      }
    };

    return () => {
      es.close();
      setStatus('idle');
    };
  }, [sessionId, touchAgent, updateTeamMember]);

  return { status, log, approvals, agents, metrics, teamHealth, removeApproval };
}
