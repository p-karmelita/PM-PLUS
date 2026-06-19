import 'dotenv/config';
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

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
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
app.use('/', reporterRoutes);
app.use('/', messagesRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
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
  console.log(`\nHealth:`);
  console.log(`  GET    /health`);
});
