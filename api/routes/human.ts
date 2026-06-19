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
router.post('/approval-response', async (req: Request, res: Response) => {
  try {
    const { requestId, approved, reason, flag_id, pm_notes } = req.body;

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

    stateStore.resolveApproval(requestId);

    // Bridge: if flag_id provided, post ApprovalResponse to Band OPS room
    // so the Risk Analyzer's waiting future resolves.
    const resolvedFlagId = flag_id || requestId;
    const opsRoom = process.env.OPS_ROOM_ID || '';
    const apiKey = process.env.REPORTER_API_KEY || process.env.RISK_ANALYZER_API_KEY || '';
    const bandUrl = process.env.BAND_REST_URL || 'https://app.band.ai/api/v1';

    if (opsRoom && apiKey) {
      const approvalPayload = {
        type: 'approval',
        flag_id: resolvedFlagId,
        approved,
        pm_notes: pm_notes || reason || null,
      };
      try {
        await fetch(`${bandUrl}/agent/chats/${opsRoom}/messages`, {
          method: 'POST',
          headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              content: `@risk_analyzer ${JSON.stringify(approvalPayload)}`,
              mentions: [],
            }
          }),
        });
      } catch (bandErr) {
        console.error('Failed to post approval to Band:', bandErr);
      }
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error in approval-response:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
