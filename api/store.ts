import {
  SessionState,
  ApprovalRequest,
  StateEvent,
  UpdateEvent,
  Resource,
  ResourceAllocation,
  ResourceBalancingRecommendation,
  CollectedData,
  ProjectMetrics,
  AgentMessage,
  AgentCheckIn
} from './types';
import { EventEmitter } from 'events';

class StateStore extends EventEmitter {
  private sessions: Map<string, SessionState> = new Map();
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private resources: Map<string, Resource> = new Map();
  private resourceAllocations: Map<string, ResourceAllocation> = new Map();
  private collectedData: Map<string, CollectedData> = new Map();
  private recommendations: Map<string, ResourceBalancingRecommendation> = new Map();
  private agentMessages: Map<string, AgentMessage> = new Map();
  private agentCheckIns: Map<string, AgentCheckIn> = new Map();
  private projectMetrics: Map<string, ProjectMetrics> = new Map();

  createSession(sessionId: string, agentId: string): SessionState {
    const session: SessionState = {
      sessionId,
      status: 'active',
      agents: [{
        agentId,
        status: 'active',
        lastActivity: new Date().toISOString()
      }],
      events: [],
      pendingApprovals: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.sessions.set(sessionId, session);
    this.emitUpdate(sessionId, 'state_change', session);
    return session;
  }

  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  updateSessionStatus(sessionId: string, status: SessionState['status']): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.updatedAt = new Date().toISOString();
      this.sessions.set(sessionId, session);
      this.emitUpdate(sessionId, 'state_change', session);
    }
  }

  addEvent(sessionId: string, event: StateEvent): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.events.push(event);
      session.updatedAt = new Date().toISOString();
      this.sessions.set(sessionId, session);
      this.emitUpdate(sessionId, 'agent_message', event);
    }
  }

  addApprovalRequest(sessionId: string, request: ApprovalRequest): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingApprovals.push(request);
      session.updatedAt = new Date().toISOString();
      this.approvalRequests.set(request.requestId, request);
      this.sessions.set(sessionId, session);
      this.emitUpdate(sessionId, 'approval_request', request);
    }
  }

  resolveApproval(requestId: string): void {
    const request = this.approvalRequests.get(requestId);
    if (request) {
      const session = this.sessions.get(request.sessionId);
      if (session) {
        session.pendingApprovals = session.pendingApprovals.filter(
          r => r.requestId !== requestId
        );
        session.updatedAt = new Date().toISOString();
        this.sessions.set(request.sessionId, session);
        this.approvalRequests.delete(requestId);
      }
    }
  }

  private emitUpdate(sessionId: string, type: UpdateEvent['type'], data: any): void {
    const event: UpdateEvent = {
      type,
      sessionId,
      data,
      timestamp: new Date().toISOString()
    };
    this.emit('update', event);
  }

  // Resource Management Methods
  addResource(resource: Resource): void {
    this.resources.set(resource.resourceId, resource);
  }

  getResource(resourceId: string): Resource | undefined {
    return this.resources.get(resourceId);
  }

  getAllResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  updateResourceAvailability(resourceId: string, availability: Resource['availability']): void {
    const resource = this.resources.get(resourceId);
    if (resource) {
      resource.availability = availability;
      this.resources.set(resourceId, resource);
    }
  }

  updateResourceLoad(resourceId: string, currentLoad: number): void {
    const resource = this.resources.get(resourceId);
    if (resource) {
      resource.currentLoad = currentLoad;
      this.resources.set(resourceId, resource);
    }
  }

  // Resource Allocation Methods
  addResourceAllocation(allocation: ResourceAllocation): void {
    this.resourceAllocations.set(allocation.allocationId, allocation);
    const resource = this.resources.get(allocation.resourceId);
    if (resource) {
      resource.currentLoad += 1;
      this.resources.set(allocation.resourceId, resource);
    }
  }

  getResourceAllocation(allocationId: string): ResourceAllocation | undefined {
    return this.resourceAllocations.get(allocationId);
  }

  getSessionAllocations(sessionId: string): ResourceAllocation[] {
    return Array.from(this.resourceAllocations.values())
      .filter(alloc => alloc.sessionId === sessionId);
  }

  removeResourceAllocation(allocationId: string): void {
    const allocation = this.resourceAllocations.get(allocationId);
    if (allocation) {
      const resource = this.resources.get(allocation.resourceId);
      if (resource && resource.currentLoad > 0) {
        resource.currentLoad -= 1;
        this.resources.set(allocation.resourceId, resource);
      }
      this.resourceAllocations.delete(allocationId);
    }
  }

  // Collector Data Methods
  addCollectedData(data: CollectedData): void {
    this.collectedData.set(data.dataId, data);
    this.emitUpdate(data.sessionId, 'agent_message', data);
  }

  getCollectedData(dataId: string): CollectedData | undefined {
    return this.collectedData.get(dataId);
  }

  getSessionCollectedData(sessionId: string, status?: CollectedData['status']): CollectedData[] {
    const data = Array.from(this.collectedData.values())
      .filter(d => d.sessionId === sessionId);
    
    if (status) {
      return data.filter(d => d.status === status);
    }
    return data;
  }

  updateCollectedDataStatus(dataId: string, status: CollectedData['status']): void {
    const data = this.collectedData.get(dataId);
    if (data) {
      data.status = status;
      if (status === 'processed') {
        data.processedAt = new Date().toISOString();
      }
      this.collectedData.set(dataId, data);
    }
  }

  // Resource Balancing Recommendations
  addRecommendation(recommendation: ResourceBalancingRecommendation): void {
    this.recommendations.set(recommendation.recommendationId, recommendation);
    this.emitUpdate(recommendation.sessionId, 'agent_message', recommendation);
  }

  getRecommendation(recommendationId: string): ResourceBalancingRecommendation | undefined {
    return this.recommendations.get(recommendationId);
  }

  getSessionRecommendations(sessionId: string): ResourceBalancingRecommendation[] {
    return Array.from(this.recommendations.values())
      .filter(rec => rec.sessionId === sessionId);
  }

  // Agent Communication Methods
  addAgentMessage(message: AgentMessage): void {
    this.agentMessages.set(message.messageId, message);
    this.emitUpdate(message.sessionId, 'agent_message', message);
  }

  getAgentMessage(messageId: string): AgentMessage | undefined {
    return this.agentMessages.get(messageId);
  }

  getSessionMessages(sessionId: string): AgentMessage[] {
    return Array.from(this.agentMessages.values())
      .filter(msg => msg.sessionId === sessionId)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }

  // Agent Check-in Methods
  addAgentCheckIn(checkIn: AgentCheckIn): void {
    this.agentCheckIns.set(checkIn.checkInId, checkIn);
    
    // Update session agent status
    const session = this.sessions.get(checkIn.sessionId);
    if (session) {
      const agentIndex = session.agents.findIndex(a => a.agentId === checkIn.agentId);
      if (agentIndex >= 0) {
        session.agents[agentIndex].status = checkIn.status;
        session.agents[agentIndex].lastActivity = checkIn.timestamp;
      } else {
        session.agents.push({
          agentId: checkIn.agentId,
          status: checkIn.status,
          lastActivity: checkIn.timestamp
        });
      }
      session.updatedAt = new Date().toISOString();
      this.sessions.set(checkIn.sessionId, session);
      this.emitUpdate(checkIn.sessionId, 'state_change', session);
    }
  }

  getAgentCheckIn(checkInId: string): AgentCheckIn | undefined {
    return this.agentCheckIns.get(checkInId);
  }

  getSessionCheckIns(sessionId: string): AgentCheckIn[] {
    return Array.from(this.agentCheckIns.values())
      .filter(ci => ci.sessionId === sessionId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Project Metrics Methods
  updateProjectMetrics(metrics: ProjectMetrics): void {
    this.projectMetrics.set(metrics.sessionId, metrics);
    this.emitUpdate(metrics.sessionId, 'state_change', metrics);
  }

  getProjectMetrics(sessionId: string): ProjectMetrics | undefined {
    return this.projectMetrics.get(sessionId);
  }

  calculateProjectMetrics(sessionId: string): ProjectMetrics {
    const session = this.sessions.get(sessionId);
    const collectedData = this.getSessionCollectedData(sessionId);
    const allocations = this.getSessionAllocations(sessionId);
    
    const totalTasks = collectedData.filter(d => d.category === 'update').length;
    const completedTasks = collectedData.filter(d =>
      d.category === 'update' && d.status === 'processed'
    ).length;
    const blockedTasks = collectedData.filter(d => d.category === 'blocker').length;
    const activeAgents = session?.agents.filter(a => a.status === 'active').length || 0;
    
    const totalCapacity = Array.from(this.resources.values())
      .reduce((sum, r) => sum + r.capacity, 0);
    const totalLoad = Array.from(this.resources.values())
      .reduce((sum, r) => sum + r.currentLoad, 0);
    const resourceUtilization = totalCapacity > 0 ? (totalLoad / totalCapacity) * 100 : 0;
    
    const criticalRisks = collectedData.filter(d =>
      d.category === 'risk' && d.priority === 'critical'
    ).length;
    const riskLevel: ProjectMetrics['riskLevel'] =
      criticalRisks > 0 ? 'critical' :
      blockedTasks > 3 ? 'high' :
      blockedTasks > 1 ? 'medium' : 'low';
    
    const metrics: ProjectMetrics = {
      sessionId,
      totalTasks,
      completedTasks,
      blockedTasks,
      activeAgents,
      resourceUtilization,
      riskLevel,
      lastUpdated: new Date().toISOString()
    };
    
    this.updateProjectMetrics(metrics);
    return metrics;
  }
}

export const stateStore = new StateStore();
