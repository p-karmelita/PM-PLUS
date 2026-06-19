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
