import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API routes are proxied to the Express backend on :3000 so the browser talks to
// a single origin (no CORS, and EventSource/SSE works through the proxy).
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3000';
const apiPaths = [
  '/updates',
  '/human',
  '/demo',
  '/state',
  '/collector',
  '/resource-balancer',
  '/resource-recommendations',
  '/analytics',
  '/exports',
  '/integrations',
  '/reporter',
  '/agent',
  '/agent-messages',
  '/me',
  '/decisions',
  '/risks',
  '/reports',
  '/pm-chat',
  '/scheduler',
  '/events',
  '/checkins',
  '/weekly-snapshot',
  '/health',
  '/api-docs',
  '/api-docs.json'
];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      apiPaths.map((p) => [
        p,
        {
          target: API_TARGET,
          changeOrigin: true,
          secure: false,
          ws: true // Enable WebSocket proxying for SSE
        }
      ])
    )
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
