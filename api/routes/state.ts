import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { stateStore } from '../store';
import { StateEvent } from '../types';

const router = Router();

/**
 * @openapi
 * /state:
 *   get:
 *     tags:
 *       - State Management
 *     summary: Get session state
 *     description: Retrieves the current state of a session
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID to retrieve
 *     responses:
 *       200:
 *         description: Session state retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionState'
 *       400:
 *         description: Bad request - Missing sessionId
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
router.get('/', (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId query parameter is required'
      });
    }

    const session = stateStore.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    res.status(200).json(session);
  } catch (error) {
    console.error('Error in get state:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /state/event:
 *   post:
 *     tags:
 *       - State Management
 *     summary: Record state event
 *     description: Records a new event in the session state
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StateEvent'
 *           example:
 *             sessionId: "session_123"
 *             agentId: "agent_456"
 *             eventType: "task_completed"
 *             payload:
 *               taskId: "task_001"
 *               result: "success"
 *     responses:
 *       201:
 *         description: Event recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StateEvent'
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
router.post('/event', (req: Request, res: Response) => {
  try {
    const { sessionId, agentId, eventType, payload } = req.body;

    if (!sessionId || !agentId || !eventType) {
      return res.status(400).json({
        error: 'sessionId, agentId, and eventType are required'
      });
    }

    // Verify session exists
    const session = stateStore.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    const event: StateEvent = {
      eventId: uuidv4(),
      sessionId,
      agentId,
      eventType,
      payload: payload || {},
      timestamp: new Date().toISOString()
    };

    stateStore.addEvent(sessionId, event);

    res.status(201).json(event);
  } catch (error) {
    console.error('Error in post event:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
