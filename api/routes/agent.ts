import { Router, Request, Response } from 'express';
import { stateStore } from '../store';

const router = Router();

const getApiKey = (req: Request): string | undefined => {
  return (req.headers['x-api-key'] as string) || process.env.BAND_API_KEY;
};

/**
 * @openapi
 * /agent/me:
 *   get:
 *     tags:
 *       - Agent API
 *     summary: Get current agent profile
 *     description: Fetches the current agent's profile from Band.ai
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Agent profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 status:
 *                   type: string
 *       401:
 *         description: Unauthorized - Missing or invalid API key
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
router.get('/me', async (req: Request, res: Response) => {
  try {
    const apiKey = getApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        error: 'X-API-Key header or BAND_API_KEY env variable is required'
      });
    }

    const url = 'https://app.band.ai/api/v1/agent/me';
    const options = {
      method: 'GET',
      headers: { 'X-API-Key': apiKey }
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Band.ai API error: ${response.statusText}`
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error in /agent/me:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /agent/chats/{chatId}/context:
 *   get:
 *     tags:
 *       - Agent API
 *     summary: Get agent context for rehydration
 *     description: Retrieves agent context from a specific chat for rehydration
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat room ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of items to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: page_size
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Context retrieved successfully
 *       401:
 *         description: Unauthorized
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
router.get('/chats/:chatId/context', async (req: Request, res: Response) => {
  try {
    const apiKey = getApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        error: 'X-API-Key header or BAND_API_KEY env variable is required'
      });
    }

    const { chatId } = req.params;
    const limit = req.query.limit || '50';
    const page = req.query.page || '1';
    const pageSize = req.query.page_size || '50';

    const url = `https://app.band.ai/api/v1/agent/chats/${chatId}/context?limit=${limit}&page=${page}&page_size=${pageSize}`;
    const options = {
      method: 'GET',
      headers: { 'X-API-Key': apiKey }
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Band.ai API error: ${response.statusText}`
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error in /agent/chats/:chatId/context:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /agent/chats/{chatId}/activity:
 *   post:
 *     tags:
 *       - Agent API
 *     summary: Report agent activity
 *     description: Send a keep-alive signal to indicate the agent is working
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - working
 *             properties:
 *               working:
 *                 type: boolean
 *                 description: Whether the agent is currently working
 *           example:
 *             working: true
 *     responses:
 *       200:
 *         description: Activity reported successfully
 *       400:
 *         description: Bad request - Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
router.post('/chats/:chatId/activity', async (req: Request, res: Response) => {
  try {
    const apiKey = getApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        error: 'X-API-Key header or BAND_API_KEY env variable is required'
      });
    }

    const { chatId } = req.params;
    const { working } = req.body;

    if (typeof working !== 'boolean') {
      return res.status(400).json({
        error: 'working (boolean) is required in request body'
      });
    }

    const url = `https://app.band.ai/api/v1/agent/chats/${chatId}/activity`;
    const options = {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ working })
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Band.ai API error: ${response.statusText}`
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error in /agent/chats/:chatId/activity:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
