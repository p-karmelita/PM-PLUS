import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { stateStore } from '../store';
import { CollectedData, AgentCheckIn } from '../types';
import { createBandAiService } from '../services/bandai.service';

const router = Router();
const collectorService = createBandAiService('collector');

/**
 * @openapi
 * /collector/check-in:
 *   post:
 *     tags:
 *       - Collector Agent
 *     summary: Collector agent check-in
 *     description: Register collector agent activity for a session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, idle, error]
 *               metadata:
 *                 type: object
 *           example:
 *             sessionId: "session_123"
 *             status: "active"
 *             metadata:
 *               source: "automated"
 *     responses:
 *       201:
 *         description: Check-in recorded successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.post('/check-in', async (req: Request, res: Response) => {
  try {
    const { sessionId, status, metadata } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId is required'
      });
    }

    // Verify session exists or create it
    let session = stateStore.getSession(sessionId);
    if (!session) {
      const profile = await collectorService.getAgentProfile();
      session = stateStore.createSession(sessionId, profile.id);
    }

    const checkIn: AgentCheckIn = {
      checkInId: uuidv4(),
      sessionId,
      agentId: process.env.COLLECTOR_AGENT_ID || '24437a9a-161b-4719-a1d3-1127969c355d',
      agentType: 'collector',
      status: status || 'active',
      metadata,
      timestamp: new Date().toISOString()
    };

    stateStore.addAgentCheckIn(checkIn);

    res.status(201).json(checkIn);
  } catch (error) {
    console.error('Error in collector check-in:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /collector/data:
 *   post:
 *     tags:
 *       - Collector Agent
 *     summary: Submit collected data
 *     description: Submit data collected by the collector agent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - sourceType
 *               - source
 *               - category
 *               - content
 *             properties:
 *               sessionId:
 *                 type: string
 *               sourceType:
 *                 type: string
 *                 enum: [check-in, status-report, external-signal, risk-alert, blocker]
 *               source:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [update, risk, blocker, resource, milestone]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               content:
 *                 type: object
 *           example:
 *             sessionId: "session_123"
 *             sourceType: "status-report"
 *             source: "team-standup"
 *             category: "update"
 *             priority: "medium"
 *             content:
 *               taskId: "TASK-001"
 *               status: "in-progress"
 *               progress: 75
 *     responses:
 *       201:
 *         description: Data collected successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.post('/data', (req: Request, res: Response) => {
  try {
    const { sessionId, sourceType, source, category, priority, content } = req.body;

    if (!sessionId || !sourceType || !source || !category || !content) {
      return res.status(400).json({
        error: 'sessionId, sourceType, source, category, and content are required'
      });
    }

    // Verify session exists
    const session = stateStore.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    const data: CollectedData = {
      dataId: uuidv4(),
      sessionId,
      sourceType,
      source,
      category,
      priority: priority || 'medium',
      content,
      collectedAt: new Date().toISOString(),
      status: 'pending'
    };

    stateStore.addCollectedData(data);

    // Update project metrics
    stateStore.calculateProjectMetrics(sessionId);

    res.status(201).json(data);
  } catch (error) {
    console.error('Error in collector data submission:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /collector/data/{dataId}/process:
 *   post:
 *     tags:
 *       - Collector Agent
 *     summary: Mark data as processed
 *     description: Update the status of collected data to processed
 *     parameters:
 *       - in: path
 *         name: dataId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Data marked as processed
 *       404:
 *         description: Data not found
 *       500:
 *         description: Internal server error
 */
router.post('/data/:dataId/process', (req: Request, res: Response) => {
  try {
    const { dataId } = req.params;

    const data = stateStore.getCollectedData(dataId);
    if (!data) {
      return res.status(404).json({
        error: 'Data not found'
      });
    }

    stateStore.updateCollectedDataStatus(dataId, 'processed');

    // Update project metrics
    stateStore.calculateProjectMetrics(data.sessionId);

    res.status(200).json({
      dataId,
      status: 'processed',
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing data:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /collector/data:
 *   get:
 *     tags:
 *       - Collector Agent
 *     summary: Get collected data
 *     description: Retrieve collected data for a session
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processed, archived]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [update, risk, blocker, resource, milestone]
 *     responses:
 *       200:
 *         description: Data retrieved successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.get('/data', (req: Request, res: Response) => {
  try {
    const { sessionId, status, category } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId query parameter is required'
      });
    }

    let data = stateStore.getSessionCollectedData(
      sessionId as string,
      status as CollectedData['status']
    );

    if (category) {
      data = data.filter(d => d.category === category);
    }

    res.status(200).json({
      sessionId,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error retrieving collected data:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /collector/activity:
 *   post:
 *     tags:
 *       - Collector Agent
 *     summary: Report collector activity
 *     description: Send keep-alive signal to Band.ai for collector agent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *               - working
 *             properties:
 *               chatId:
 *                 type: string
 *               working:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Activity reported successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.post('/activity', async (req: Request, res: Response) => {
  try {
    const { chatId, working } = req.body;

    if (!chatId || typeof working !== 'boolean') {
      return res.status(400).json({
        error: 'chatId and working (boolean) are required'
      });
    }

    const result = await collectorService.reportActivity(chatId, working);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error reporting collector activity:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;

// Made with Bob
