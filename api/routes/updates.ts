import { Router, Request, Response } from 'express';
import { stateStore } from '../store';
import { UpdateEvent } from '../types';

const router = Router();

/**
 * GET /updates?sessionId=xxx
 * Server-Sent Events endpoint for real-time updates
 */
router.get('/', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    return res.status(400).json({
      error: 'sessionId query parameter is required'
    });
  }

  // Verify session exists
  const session = stateStore.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'Session not found'
    });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    sessionId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Listen for updates
  const updateListener = (event: UpdateEvent) => {
    // sessionId '*' is the Python-agent broadcast wildcard; pass it to every subscriber.
    if (event.sessionId === sessionId || event.sessionId === '*') {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  stateStore.on('update', updateListener);

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    stateStore.removeListener('update', updateListener);
    clearInterval(heartbeat);
    res.end();
  });
});

export default router;
