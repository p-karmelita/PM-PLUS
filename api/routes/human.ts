import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { stateStore } from '../store';
import { ApprovalRequest, ApprovalResponse } from '../types';

const router = Router();

/**
 * @openapi
 * /human/approval-request:
 *   post:
 *     tags:
 *       - Human-in-the-Loop
 *     summary: Create approval request
 *     description: Creates a new approval request that requires human intervention
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApprovalRequest'
 *           example:
 *             sessionId: "session_123"
 *             agentId: "agent_456"
 *             action: "deploy_to_production"
 *             context:
 *               description: "Deploy version 2.0"
 *               impact: "high"
 *     responses:
 *       201:
 *         description: Approval request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApprovalRequest'
 *       400:
 *         description: Bad request - Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/approval-request', (req: Request, res: Response) => {
  try {
    const { sessionId, agentId, action, context } = req.body;

    if (!sessionId || !agentId || !action) {
      return res.status(400).json({
        error: 'sessionId, agentId, and action are required'
      });
    }

    // Verify session exists
    const session = stateStore.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    const request: ApprovalRequest = {
      requestId: uuidv4(),
      sessionId,
      agentId,
      action,
      context: context || {},
      requestedAt: new Date().toISOString()
    };

    stateStore.addApprovalRequest(sessionId, request);

    res.status(201).json(request);
  } catch (error) {
    console.error('Error in approval-request:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /human/approval-response:
 *   post:
 *     tags:
 *       - Human-in-the-Loop
 *     summary: Respond to approval request
 *     description: Responds to a pending approval request with approval or rejection
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApprovalResponse'
 *           example:
 *             requestId: "req_789"
 *             approved: true
 *             reason: "Approved after review"
 *     responses:
 *       200:
 *         description: Response submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApprovalResponse'
 *       400:
 *         description: Bad request - Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/approval-response', (req: Request, res: Response) => {
  try {
    const { requestId, approved, reason } = req.body;

    if (!requestId || typeof approved !== 'boolean') {
      return res.status(400).json({
        error: 'requestId and approved (boolean) are required'
      });
    }

    const response: ApprovalResponse = {
      requestId,
      approved,
      reason,
      respondedAt: new Date().toISOString()
    };

    // Resolve the approval request
    stateStore.resolveApproval(requestId);

    res.status(200).json(response);
  } catch (error) {
    console.error('Error in approval-response:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
