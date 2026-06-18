import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PM-PLUS API',
      version: '1.0.0',
      description: 'Agent orchestration API with Band.ai integration for multi-agent project management',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Band.ai API key for authentication',
        },
      },
      schemas: {
        SessionState: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['active', 'paused', 'completed', 'failed']
            },
            agents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  agentId: { type: 'string' },
                  status: { type: 'string' },
                  lastActivity: { type: 'string', format: 'date-time' },
                },
              },
            },
            events: {
              type: 'array',
              items: { $ref: '#/components/schemas/StateEvent' }
            },
            pendingApprovals: {
              type: 'array',
              items: { $ref: '#/components/schemas/ApprovalRequest' }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ApprovalRequest: {
          type: 'object',
          required: ['sessionId', 'agentId', 'action'],
          properties: {
            requestId: { type: 'string' },
            sessionId: { type: 'string' },
            agentId: { type: 'string' },
            action: { type: 'string' },
            context: { type: 'object', additionalProperties: true },
            requestedAt: { type: 'string', format: 'date-time' },
          },
        },
        ApprovalResponse: {
          type: 'object',
          required: ['requestId', 'approved'],
          properties: {
            requestId: { type: 'string' },
            approved: { type: 'boolean' },
            reason: { type: 'string' },
            respondedAt: { type: 'string', format: 'date-time' },
          },
        },
        StateEvent: {
          type: 'object',
          required: ['sessionId', 'agentId', 'eventType'],
          properties: {
            eventId: { type: 'string' },
            sessionId: { type: 'string' },
            agentId: { type: 'string' },
            eventType: { type: 'string' },
            payload: { type: 'object', additionalProperties: true },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', description: 'Message content with optional @mentions' },
            mentions: {
              type: 'array',
              items: { type: 'object' },
              description: 'Array of mention objects'
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
