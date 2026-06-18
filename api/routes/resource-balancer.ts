import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { stateStore } from '../store';
import { 
  Resource, 
  ResourceAllocation, 
  ResourceBalancingRecommendation,
  AgentCheckIn 
} from '../types';
import { createBandAiService } from '../services/bandai.service';

const router = Router();
const balancerService = createBandAiService('resource_balancer');

router.post('/check-in', async (req: Request, res: Response) => {
  try {
    const { sessionId, status, metadata } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    let session = stateStore.getSession(sessionId);
    if (!session) {
      const profile = await balancerService.getAgentProfile();
      session = stateStore.createSession(sessionId, profile.id);
    }
    const checkIn: AgentCheckIn = {
      checkInId: uuidv4(),
      sessionId,
      agentId: process.env.RESOURCE_BALANCER_AGENT_ID || '0bcdb5ba-79b1-4072-87c4-3df8538e58b3',
      agentType: 'resource_balancer',
      status: status || 'active',
      metadata,
      timestamp: new Date().toISOString()
    };
    stateStore.addAgentCheckIn(checkIn);
    res.status(201).json(checkIn);
  } catch (error) {
    console.error('Error in resource balancer check-in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/resources', (req: Request, res: Response) => {
  try {
    const { name, type, capacity, availability, skills, metadata } = req.body;
    if (!name || !type || capacity === undefined) {
      return res.status(400).json({ error: 'name, type, and capacity are required' });
    }
    const resource: Resource = {
      resourceId: uuidv4(),
      name, type, capacity,
      currentLoad: 0,
      availability: availability || 'available',
      skills, metadata
    };
    stateStore.addResource(resource);
    res.status(201).json(resource);
  } catch (error) {
    console.error('Error registering resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/resources', (req: Request, res: Response) => {
  try {
    const { type, availability } = req.query;
    let resources = stateStore.getAllResources();
    if (type) resources = resources.filter(r => r.type === type);
    if (availability) resources = resources.filter(r => r.availability === availability);
    res.status(200).json({ count: resources.length, resources });
  } catch (error) {
    console.error('Error retrieving resources:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/resources/:resourceId', (req: Request, res: Response) => {
  try {
    const { resourceId } = req.params;
    const { availability, currentLoad } = req.body;
    const resource = stateStore.getResource(resourceId);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    if (availability) stateStore.updateResourceAvailability(resourceId, availability);
    if (currentLoad !== undefined) stateStore.updateResourceLoad(resourceId, currentLoad);
    const updatedResource = stateStore.getResource(resourceId);
    res.status(200).json(updatedResource);
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/allocations', (req: Request, res: Response) => {
  try {
    const { resourceId, sessionId, taskId, estimatedDuration, priority } = req.body;
    if (!resourceId || !sessionId || !priority) {
      return res.status(400).json({ error: 'resourceId, sessionId, and priority are required' });
    }
    const resource = stateStore.getResource(resourceId);
    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    const session = stateStore.getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const allocation: ResourceAllocation = {
      allocationId: uuidv4(),
      resourceId, sessionId, taskId,
      allocatedAt: new Date().toISOString(),
      estimatedDuration, priority
    };
    stateStore.addResourceAllocation(allocation);
    stateStore.calculateProjectMetrics(sessionId);
    res.status(201).json(allocation);
  } catch (error) {
    console.error('Error creating allocation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/allocations', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId query parameter is required' });
    const allocations = stateStore.getSessionAllocations(sessionId as string);
    res.status(200).json({ sessionId, count: allocations.length, allocations });
  } catch (error) {
    console.error('Error retrieving allocations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/allocations/:allocationId', (req: Request, res: Response) => {
  try {
    const { allocationId } = req.params;
    const allocation = stateStore.getResourceAllocation(allocationId);
    if (!allocation) return res.status(404).json({ error: 'Allocation not found' });
    stateStore.removeResourceAllocation(allocationId);
    stateStore.calculateProjectMetrics(allocation.sessionId);
    res.status(200).json({ allocationId, message: 'Allocation removed successfully' });
  } catch (error) {
    console.error('Error removing allocation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/recommendations', (req: Request, res: Response) => {
  try {
    const { sessionId, type, severity, description, affectedResources, suggestedActions, requiresApproval } = req.body;
    if (!sessionId || !type || !severity || !description || !affectedResources) {
      return res.status(400).json({ error: 'sessionId, type, severity, description, and affectedResources are required' });
    }
    const session = stateStore.getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const recommendation: ResourceBalancingRecommendation = {
      recommendationId: uuidv4(),
      sessionId, type, severity, description,
      affectedResources,
      suggestedActions: suggestedActions || [],
      requiresApproval: requiresApproval || false,
      createdAt: new Date().toISOString()
    };
    stateStore.addRecommendation(recommendation);
    if (requiresApproval) {
      const approvalRequest = {
        requestId: uuidv4(),
        sessionId,
        agentId: process.env.RESOURCE_BALANCER_AGENT_ID || '0bcdb5ba-79b1-4072-87c4-3df8538e58b3',
        action: `resource_balancing_${type}`,
        context: {
          recommendationId: recommendation.recommendationId,
          description, affectedResources, suggestedActions
        },
        requestedAt: new Date().toISOString()
      };
      stateStore.addApprovalRequest(sessionId, approvalRequest);
    }
    res.status(201).json(recommendation);
  } catch (error) {
    console.error('Error creating recommendation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recommendations', (req: Request, res: Response) => {
  try {
    const { sessionId, severity } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId query parameter is required' });
    let recommendations = stateStore.getSessionRecommendations(sessionId as string);
    if (severity) recommendations = recommendations.filter(r => r.severity === severity);
    res.status(200).json({ sessionId, count: recommendations.length, recommendations });
  } catch (error) {
    console.error('Error retrieving recommendations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/metrics', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId query parameter is required' });
    const metrics = stateStore.calculateProjectMetrics(sessionId as string);
    res.status(200).json(metrics);
  } catch (error) {
    console.error('Error retrieving metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/activity', async (req: Request, res: Response) => {
  try {
    const { chatId, working } = req.body;
    if (!chatId || typeof working !== 'boolean') {
      return res.status(400).json({ error: 'chatId and working (boolean) are required' });
    }
    const result = await balancerService.reportActivity(chatId, working);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error reporting balancer activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
