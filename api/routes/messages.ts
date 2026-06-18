import { Router, Request, Response } from 'express';

const router = Router();

const getApiKey = (req: Request): string | undefined => {
  return (req.headers['x-api-key'] as string) || process.env.BAND_API_KEY;
};

/**
 * @openapi
 * /me/chats/{chatId}/messages:
 *   post:
 *     tags:
 *       - Human API
 *     summary: Send a message as the user
 *     description: Send a text message as the human user to a chat room
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
 *               - message
 *             properties:
 *               message:
 *                 $ref: '#/components/schemas/Message'
 *           example:
 *             message:
 *               content: "@DataAnalyst please analyze the Q4 sales data"
 *               mentions: [{}]
 *     responses:
 *       200:
 *         description: Message sent successfully
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
router.post('/me/chats/:chatId/messages', async (req: Request, res: Response) => {
  try {
    const apiKey = getApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        error: 'X-API-Key header or BAND_API_KEY env variable is required'
      });
    }

    const { chatId } = req.params;
    const { message } = req.body;

    if (!message || !message.content) {
      return res.status(400).json({
        error: 'message.content is required'
      });
    }

    const url = `https://app.band.ai/api/v1/me/chats/${chatId}/messages`;
    const options = {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
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
    console.error('Error in /me/chats/:chatId/messages:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * @openapi
 * /me/chats/{chatId}/messages:
 *   get:
 *     tags:
 *       - Human API
 *     summary: List messages in a chat room
 *     description: Retrieve messages from a specific chat room
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
 *         description: Number of messages to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
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
router.get('/me/chats/:chatId/messages', async (req: Request, res: Response) => {
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

    const url = `https://app.band.ai/api/v1/me/chats/${chatId}/messages?limit=${limit}&page=${page}`;
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
    console.error('Error in GET /me/chats/:chatId/messages:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
