import 'dotenv/config';
import path from 'path';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import demoRoutes from './routes/demo';
import updatesRoutes from './routes/updates';
import humanRoutes from './routes/human';
import stateRoutes from './routes/state';
import agentRoutes from './routes/agent';
import messagesRoutes from './routes/messages';
import meRoutes from './routes/me';
import collectorRoutes from './routes/collector';
import resourceBalancerRoutes from './routes/resource-balancer';
import reporterRoutes from './routes/reporter';
import eventsRoutes from './routes/events';
import backboneRoutes from './routes/backbone';
import { schedulerService } from './backbone/scheduler.service';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware - allow all origins in development, configure for production
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://pm-plus-production.up.railway.app'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

const AUTH_PROTECTED_PREFIXES = [
  '/agent',
  '/agent-messages',
  '/analytics',
  '/collector',
  '/decisions',
  '/demo',
  '/events',
  '/exports',
  '/human',
  '/integrations',
  '/me',
  '/pm-chat',
  '/reports',
  '/resource-balancer',
  '/resource-recommendations',
  '/risks',
  '/scheduler',
  '/state',
  '/updates',
];

app.use((req, res, next) => {
  const token = process.env.API_AUTH_TOKEN;
  if (!token) return next();

  const shouldProtect = AUTH_PROTECTED_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`));
  if (!shouldProtect) return next();

  const headerToken = req.header('X-API-Key');
  const bearerToken = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  const queryToken = typeof req.query.apiKey === 'string' ? req.query.apiKey : undefined;

  if (headerToken === token || bearerToken === token || queryToken === token) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
});

// Swagger UI with API Key pre-fill
const swaggerOptions = {
  swaggerOptions: {
    persistAuthorization: true,
  },
};

// Swagger documentation routes
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerOptions));

// Serve OpenAPI spec as JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.use('/demo', demoRoutes);
app.use('/updates', updatesRoutes);
app.use('/human', humanRoutes);
app.use('/state', stateRoutes);
app.use('/agent', agentRoutes);
app.use('/me', meRoutes);
app.use('/collector', collectorRoutes);
app.use('/resource-balancer', resourceBalancerRoutes);
app.use('/events', eventsRoutes);
app.use('/', reporterRoutes);
app.use('/', messagesRoutes);
app.use('/', backboneRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the built React dashboard (production / hosted).
// In dev, Vite runs on :5173 and proxies API calls to this server.
const DASH_DIST = path.join(__dirname, '..', 'dashboard', 'dist');
app.use(express.static(DASH_DIST));

// SPA fallback — any non-API GET that reaches this point returns index.html.
app.get('*', (_req, res, next) => {
  res.sendFile(path.join(DASH_DIST, 'index.html'), (err) => {
    if (err) next();
  });
});

// 404 handler (API routes that truly don't exist)
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  schedulerService.start();
  console.log(`API server running on port ${PORT}`);
  console.log(`\n📚 Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`📄 OpenAPI Spec: http://localhost:${PORT}/api-docs.json`);
  console.log(`\nAvailable endpoints:`);
  console.log(`\nLegacy/Demo:`);
  console.log(`  GET    /demo/start-checkin`);
  console.log(`  GET    /updates?sessionId=xxx`);
  console.log(`\nUser Profile:`);
  console.log(`  GET    /me`);
  console.log(`\nAgent API (Band.ai proxy - requires agent key):`);
  console.log(`  GET    /agent/me`);
  console.log(`  GET    /agent/chats/:chatId/context`);
  console.log(`  POST   /agent/chats/:chatId/activity`);
  console.log(`\nHuman API (Band.ai proxy - requires user key):`);
  console.log(`  POST   /me/chats/:chatId/messages`);
  console.log(`  GET    /me/chats/:chatId/messages`);
  console.log(`\nCollector Agent:`);
  console.log(`  POST   /collector/check-in`);
  console.log(`  POST   /collector/data`);
  console.log(`  GET    /collector/data?sessionId=xxx`);
  console.log(`  POST   /collector/data/:dataId/process`);
  console.log(`  POST   /collector/activity`);
  console.log(`\nResource Balancer Agent:`);
  console.log(`  POST   /resource-balancer/check-in`);
  console.log(`  POST   /resource-balancer/resources`);
  console.log(`  GET    /resource-balancer/resources`);
  console.log(`  PATCH  /resource-balancer/resources/:resourceId`);
  console.log(`  POST   /resource-balancer/allocations`);
  console.log(`  GET    /resource-balancer/allocations?sessionId=xxx`);
  console.log(`  DELETE /resource-balancer/allocations/:allocationId`);
  console.log(`  POST   /resource-balancer/recommendations`);
  console.log(`  GET    /resource-balancer/recommendations?sessionId=xxx`);
  console.log(`  GET    /resource-balancer/metrics?sessionId=xxx`);
  console.log(`  POST   /resource-balancer/activity`);
  console.log(`\nReporter Agent (State Store):`);
  console.log(`  GET    /events?employee_id=xxx&days=30`);
  console.log(`  POST   /events`);
  console.log(`  POST   /checkins`);
  console.log(`  GET    /weekly-snapshot`);
  console.log(`\nHuman-in-the-Loop:`);
  console.log(`  POST   /human/approval-request`);
  console.log(`  POST   /human/approval-response  (flag_id + pm_notes → bridges to Band)`);
  console.log(`\nState Management:`);
  console.log(`  GET    /state?sessionId=xxx`);
  console.log(`  POST   /state/event`);
  console.log(`\nBackbone MVP (Data & Orchestrator):`);
  console.log(`  POST   /demo/seed-team`);
  console.log(`  POST   /demo/start-daily-checkin`);
  console.log(`  POST   /demo/run-full-scenario`);
  console.log(`  POST   /updates`);
  console.log(`  GET    /updates/:projectId`);
  console.log(`  GET    /agent-messages/:projectId`);
  console.log(`  GET    /decisions/:projectId`);
  console.log(`  GET    /decisions/pending/:projectId`);
  console.log(`  POST   /decisions`);
  console.log(`  GET    /risks/:projectId`);
  console.log(`  GET    /resource-recommendations/:projectId`);
  console.log(`  POST   /reports/weekly`);
  console.log(`  GET    /reports/weekly/:projectId`);
  console.log(`  GET    /state/:projectId`);
  console.log(`  GET    /analytics/:projectId`);
  console.log(`  GET    /exports/weekly/:projectId.csv`);
  console.log(`  GET    /exports/weekly/:projectId.pdf`);
  console.log(`  GET    /integrations/status`);
  console.log(`  POST   /integrations/notify`);
  console.log(`  POST   /pm-chat/messages`);
  console.log(`  GET    /pm-chat/:projectId`);
  console.log(`  POST   /pm-chat/:projectId/:threadId/confirm`);
  console.log(`  POST   /decisions/:projectId/:decisionId/apply`);
  console.log(`  POST   /decisions/:projectId/:decisionId/skip`);
  console.log(`  POST   /decisions/:projectId/:decisionId/audit`);
  console.log(`  GET    /scheduler/status`);
  console.log(`  POST   /scheduler/enabled`);
  console.log(`  POST   /scheduler/run-daily`);
  console.log(`  POST   /scheduler/run-weekly`);
  console.log(`\nHealth:`);
  console.log(`  GET    /health`);
});
