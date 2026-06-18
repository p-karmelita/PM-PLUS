import { stateStore } from '../store';
import { 
  AgentMessage, 
  CollectedData, 
  ResourceBalancingRecommendation,
  ProjectMetrics 
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { createBandAiService } from './bandai.service';

export class OrchestratorService {
  private collectorService = createBandAiService('collector');
  private balancerService = createBandAiService('resource_balancer');

  /**
   * Coordinate data collection and resource balancing workflow
   */
  async coordinateWorkflow(sessionId: string, chatId: string): Promise<void> {
    try {
      // Step 1: Trigger collector to gather data
      await this.triggerCollector(sessionId, chatId);

      // Step 2: Wait for data collection (in real scenario, this would be event-driven)
      const collectedData = stateStore.getSessionCollectedData(sessionId, 'pending');

      // Step 3: If there's data, trigger resource balancer analysis
      if (collectedData.length > 0) {
        await this.triggerResourceBalancer(sessionId, chatId);
      }

      // Step 4: Calculate and update metrics
      stateStore.calculateProjectMetrics(sessionId);
    } catch (error) {
      console.error('Error in workflow coordination:', error);
      throw error;
    }
  }

  /**
   * Trigger collector agent to gather data
   */
  private async triggerCollector(sessionId: string, chatId: string): Promise<void> {
    // Report collector activity
    await this.collectorService.reportActivity(chatId, true);

    // Send message to collector agent
    const message: AgentMessage = {
      messageId: uuidv4(),
      sessionId,
      fromAgentId: 'orchestrator',
      toAgentId: process.env.COLLECTOR_AGENT_ID || '24437a9a-161b-4719-a1d3-1127969c355d',
      messageType: 'request',
      content: {
        action: 'collect_data',
        instructions: 'Gather project updates, check-ins, risks, and blockers'
      },
      sentAt: new Date().toISOString()
    };

    stateStore.addAgentMessage(message);
  }

  /**
   * Trigger resource balancer agent to analyze resources
   */
  private async triggerResourceBalancer(sessionId: string, chatId: string): Promise<void> {
    // Report balancer activity
    await this.balancerService.reportActivity(chatId, true);

    // Get current metrics
    const metrics = stateStore.getProjectMetrics(sessionId);

    // Send message to resource balancer agent
    const message: AgentMessage = {
      messageId: uuidv4(),
      sessionId,
      fromAgentId: 'orchestrator',
      toAgentId: process.env.RESOURCE_BALANCER_AGENT_ID || '0bcdb5ba-79b1-4072-87c4-3df8538e58b3',
      messageType: 'request',
      content: {
        action: 'analyze_resources',
        instructions: 'Analyze resource allocation and provide recommendations',
        metrics
      },
      sentAt: new Date().toISOString()
    };

    stateStore.addAgentMessage(message);
  }

  /**
   * Process collected data and route to appropriate handlers
   */
  async processCollectedData(data: CollectedData): Promise<void> {
    try {
      // Mark as processed
      stateStore.updateCollectedDataStatus(data.dataId, 'processed');

      // Route based on category
      switch (data.category) {
        case 'risk':
        case 'blocker':
          await this.handleRiskOrBlocker(data);
          break;
        case 'resource':
          await this.handleResourceUpdate(data);
          break;
        case 'milestone':
          await this.handleMilestone(data);
          break;
        default:
          // General update, just log
          console.log(`Processed update: ${data.dataId}`);
      }

      // Update metrics after processing
      stateStore.calculateProjectMetrics(data.sessionId);
    } catch (error) {
      console.error('Error processing collected data:', error);
      throw error;
    }
  }

  /**
   * Handle risk or blocker data
   */
  private async handleRiskOrBlocker(data: CollectedData): Promise<void> {
    // Create a recommendation for high-priority risks/blockers
    if (data.priority === 'high' || data.priority === 'critical') {
      const recommendation: ResourceBalancingRecommendation = {
        recommendationId: uuidv4(),
        sessionId: data.sessionId,
        type: 'escalation',
        severity: data.priority === 'critical' ? 'critical' : 'warning',
        description: `${data.category.toUpperCase()}: ${data.content.description || 'Requires attention'}`,
        affectedResources: data.content.affectedResources || [],
        suggestedActions: [
          'Review and prioritize',
          'Allocate additional resources if needed',
          'Escalate to PM if critical'
        ],
        requiresApproval: data.priority === 'critical',
        createdAt: new Date().toISOString()
      };

      stateStore.addRecommendation(recommendation);

      // If critical, create approval request
      if (data.priority === 'critical') {
        const approvalRequest = {
          requestId: uuidv4(),
          sessionId: data.sessionId,
          agentId: 'orchestrator',
          action: `handle_${data.category}`,
          context: {
            dataId: data.dataId,
            recommendationId: recommendation.recommendationId,
            description: data.content.description,
            priority: data.priority
          },
          requestedAt: new Date().toISOString()
        };

        stateStore.addApprovalRequest(data.sessionId, approvalRequest);
      }
    }
  }

  /**
   * Handle resource-related updates
   */
  private async handleResourceUpdate(data: CollectedData): Promise<void> {
    // If resource capacity or availability changed, update metrics
    if (data.content.resourceId) {
      const resource = stateStore.getResource(data.content.resourceId);
      if (resource) {
        if (data.content.availability) {
          stateStore.updateResourceAvailability(
            data.content.resourceId,
            data.content.availability
          );
        }
        if (data.content.currentLoad !== undefined) {
          stateStore.updateResourceLoad(
            data.content.resourceId,
            data.content.currentLoad
          );
        }
      }
    }
  }

  /**
   * Handle milestone updates
   */
  private async handleMilestone(data: CollectedData): Promise<void> {
    // Log milestone achievement
    console.log(`Milestone achieved: ${data.content.name || 'Unknown'}`);

    // Create a notification message
    const message: AgentMessage = {
      messageId: uuidv4(),
      sessionId: data.sessionId,
      fromAgentId: 'orchestrator',
      messageType: 'notification',
      content: {
        type: 'milestone_achieved',
        milestone: data.content
      },
      sentAt: new Date().toISOString()
    };

    stateStore.addAgentMessage(message);
  }

  /**
   * Evaluate if human approval is needed based on recommendation
   */
  shouldRequireApproval(recommendation: ResourceBalancingRecommendation): boolean {
    // Critical severity always requires approval
    if (recommendation.severity === 'critical') {
      return true;
    }

    // Escalation and reallocation types require approval
    if (recommendation.type === 'escalation' || recommendation.type === 'reallocation') {
      return true;
    }

    // Check if affects multiple resources
    if (recommendation.affectedResources.length > 3) {
      return true;
    }

    return false;
  }

  /**
   * Get workflow status for a session
   */
  getWorkflowStatus(sessionId: string): {
    session: any;
    metrics: ProjectMetrics | undefined;
    pendingData: number;
    processedData: number;
    recommendations: number;
    pendingApprovals: number;
  } {
    const session = stateStore.getSession(sessionId);
    const metrics = stateStore.getProjectMetrics(sessionId);
    const pendingData = stateStore.getSessionCollectedData(sessionId, 'pending').length;
    const processedData = stateStore.getSessionCollectedData(sessionId, 'processed').length;
    const recommendations = stateStore.getSessionRecommendations(sessionId).length;
    const pendingApprovals = session?.pendingApprovals.length || 0;

    return {
      session,
      metrics,
      pendingData,
      processedData,
      recommendations,
      pendingApprovals
    };
  }

  /**
   * Broadcast message to all agents in a session
   */
  async broadcastToAgents(sessionId: string, content: Record<string, any>): Promise<void> {
    const session = stateStore.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    for (const agent of session.agents) {
      const message: AgentMessage = {
        messageId: uuidv4(),
        sessionId,
        fromAgentId: 'orchestrator',
        toAgentId: agent.agentId,
        messageType: 'broadcast',
        content,
        sentAt: new Date().toISOString()
      };

      stateStore.addAgentMessage(message);
    }
  }

  /**
   * Check resource health and trigger alerts if needed
   */
  async checkResourceHealth(sessionId: string): Promise<void> {
    const metrics = stateStore.getProjectMetrics(sessionId);
    if (!metrics) return;

    // Check resource utilization
    if (metrics.resourceUtilization > 80) {
      const recommendation: ResourceBalancingRecommendation = {
        recommendationId: uuidv4(),
        sessionId,
        type: 'capacity_warning',
        severity: metrics.resourceUtilization > 90 ? 'critical' : 'warning',
        description: `Resource utilization at ${metrics.resourceUtilization.toFixed(1)}%`,
        affectedResources: stateStore.getAllResources()
          .filter(r => r.currentLoad / r.capacity > 0.8)
          .map(r => r.resourceId),
        suggestedActions: [
          'Consider adding more resources',
          'Redistribute workload',
          'Defer non-critical tasks'
        ],
        requiresApproval: metrics.resourceUtilization > 90,
        createdAt: new Date().toISOString()
      };

      stateStore.addRecommendation(recommendation);
    }

    // Check for blocked tasks
    if (metrics.blockedTasks > 3) {
      const recommendation: ResourceBalancingRecommendation = {
        recommendationId: uuidv4(),
        sessionId,
        type: 'escalation',
        severity: 'warning',
        description: `${metrics.blockedTasks} tasks are currently blocked`,
        affectedResources: [],
        suggestedActions: [
          'Review blocked tasks',
          'Identify and remove blockers',
          'Escalate to PM if needed'
        ],
        requiresApproval: true,
        createdAt: new Date().toISOString()
      };

      stateStore.addRecommendation(recommendation);
    }
  }
}

export const orchestratorService = new OrchestratorService();

// Made with Bob
