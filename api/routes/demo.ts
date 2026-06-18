import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { stateStore } from '../store';
import { CheckInRequest, CheckInResponse } from '../types';

const router = Router();

/**
 * GET /demo/start-checkin
 * Fetches agent information from Band.ai API
 * Requires X-API-Key header
 */
router.get('/start-checkin', async (req: Request, res: Response) => {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || process.env.BAND_API_KEY;

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
    console.error('Error in start-checkin:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
