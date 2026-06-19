import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentHealth,
  ApprovalRequest,
  ConnectionStatus,
  LogLine,
  ProjectMetrics,
  UpdateEvent
} from '../types';

const KNOWN_AGENTS = ['collector', 'risk_analyzer', 'reporter', 'resource_balancer', 'pm'];

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
}

export function useEventStream(sessionId: string | null) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [log, setLog] = useState<LogLine[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [agents, setAgents] = useState<AgentHealth[]>([]);

  // agent name -> health, kept in a ref so updates don't depend on stale state
  const agentMap = useRef<Map<string, AgentHealth>>(new Map());

  const touchAgent = useCallback((name: string, kind: string, ts: string) => {
    if (!name || name === 'system') return;
    const negotiating = kind === 'request' || kind === 'response';
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
  }, [sessionId, touchAgent]);

  return { status, log, approvals, agents, metrics, removeApproval };
}
