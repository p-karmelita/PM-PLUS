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

// Resource Management Types
export interface Resource {
  resourceId: string;
  name: string;
  type: 'human' | 'agent' | 'service' | 'infrastructure';
  capacity: number;
  currentLoad: number;
  availability: 'available' | 'busy' | 'offline';
  skills?: string[];
  metadata?: Record<string, any>;
}

export interface ResourceAllocation {
  allocationId: string;
  resourceId: string;
  sessionId: string;
  taskId?: string;
  allocatedAt: string;
  estimatedDuration?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResourceBalancingRecommendation {
  recommendationId: string;
  sessionId: string;
  type: 'reallocation' | 'escalation' | 'load_balancing' | 'capacity_warning';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  affectedResources: string[];
  suggestedActions: string[];
  requiresApproval: boolean;
  createdAt: string;
}

// Collector Data Types
export interface CollectedData {
  dataId: string;
  sessionId: string;
  sourceType: 'check-in' | 'status-report' | 'external-signal' | 'risk-alert' | 'blocker';
  source: string;
  category: 'update' | 'risk' | 'blocker' | 'resource' | 'milestone';
  priority: 'low' | 'medium' | 'high' | 'critical';
  content: Record<string, any>;
  collectedAt: string;
  processedAt?: string;
  status: 'pending' | 'processed' | 'archived';
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

// Agent Communication Types
export interface AgentMessage {
  messageId: string;
  sessionId: string;
  fromAgentId: string;
  toAgentId?: string;
  messageType: 'request' | 'response' | 'notification' | 'broadcast';
  content: Record<string, any>;
  sentAt: string;
  receivedAt?: string;
}

export interface AgentCheckIn {
  checkInId: string;
  sessionId: string;
  agentId: string;
  agentType: 'collector' | 'resource_balancer' | 'drafter' | 'reviewer';
  status: 'active' | 'idle' | 'error';
  metadata?: Record<string, any>;
  timestamp: string;
}
