export interface CheckInRequest {
  sessionId?: string;
  agentId: string;
  metadata?: Record<string, any>;
}

export interface CheckInResponse {
  sessionId: string;
  status: 'started' | 'active' | 'completed' | 'failed';
  timestamp: string;
}

export interface ApprovalRequest {
  requestId: string;
  sessionId: string;
  agentId: string;
  action: string;
  context: Record<string, any>;
  requestedAt: string;
}

export interface ApprovalResponse {
  requestId: string;
  approved: boolean;
  reason?: string;
  respondedAt: string;
}

export interface StateEvent {
  eventId: string;
  sessionId: string;
  agentId: string;
  eventType: string;
  payload: Record<string, any>;
  timestamp: string;
}

export interface SessionState {
  sessionId: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  agents: Array<{
    agentId: string;
    status: string;
    lastActivity: string;
  }>;
  events: StateEvent[];
  pendingApprovals: ApprovalRequest[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateEvent {
  type: 'state_change' | 'approval_request' | 'agent_message' | 'error';
  sessionId: string;
  data: any;
  timestamp: string;
}
