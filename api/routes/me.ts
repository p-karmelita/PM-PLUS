import { Router, Request, Response } from 'express';

const router = Router();

const getApiKey = (req: Request): string | undefined => {
  return (req.headers['x-api-key'] as string) || process.env.BAND_API_KEY;
};

/**
 * @openapi
 * /me:
 *   get:
 *     tags:
 *       - User Profile
 *     summary: Get current user profile
 *     description: Fetches the current user's profile from Band.ai (requires user API key)
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         first_name:
 *                           type: string
 *                         last_name:
 *                           type: string
 *                     plan:
 *                       type: object
 *                       properties:
 *                         tier:
 *                           type: string
 *       401:
 *         description: Unauthorized - Missing or invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Invalid authentication type
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
router.get('/', async (req: Request, res: Response) => {
  try {
    const apiKey = getApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        error: 'X-API-Key header or BAND_API_KEY env variable is required'
      });
    }

    const url = 'https://app.band.ai/api/v1/me';
    const options = {
      method: 'GET',
      headers: { 'X-API-Key': apiKey }
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error in /me:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
