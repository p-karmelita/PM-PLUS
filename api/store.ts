import { SessionState, ApprovalRequest, StateEvent, UpdateEvent } from './types';
import { EventEmitter } from 'events';

class StateStore extends EventEmitter {
  private sessions: Map<string, SessionState> = new Map();
  private approvalRequests: Map<string, ApprovalRequest> = new Map();

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
}

export const stateStore = new StateStore();
