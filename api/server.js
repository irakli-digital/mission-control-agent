import express from 'express';
import pg from 'pg';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import config from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';

import agentRoutes from './routes/agents.js';
import taskRoutes from './routes/tasks.js';
import contentRoutes from './routes/content.js';
import workspaceRoutes from './routes/workspaces.js';
import statsRoutes from './routes/stats.js';
import graphRoutes from './routes/graph.js';
import agentConfigRoutes from './routes/agent-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Database
const pool = new pg.Pool({ connectionString: config.dbUrl });

// WebSocket
const wss = new WebSocketServer({ server });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
});

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data });
  for (const ws of wsClients) {
    if (ws.readyState === 1) {
      try { ws.send(msg); } catch {}
    }
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Serve frontend (before auth so static files load)
app.use(express.static(join(__dirname, '../frontend/dist')));

// Health endpoint (no auth)
app.get('/api/health', async (req, res) => {
  let dbStatus = 'connected';
  try {
    await pool.query('SELECT 1');
  } catch {
    dbStatus = 'error';
  }
  res.json({ ok: true, uptime: process.uptime(), db: dbStatus });
});

// Auth on all /api routes except health
app.use('/api', authMiddleware);

// Routes
app.use('/api', agentRoutes(pool));
app.use('/api', taskRoutes(pool, broadcast));
app.use('/api', contentRoutes(pool, broadcast));
app.use('/api', workspaceRoutes());
app.use('/api', statsRoutes(pool));
app.use('/api', graphRoutes());
app.use('/api', agentConfigRoutes(pool));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../frontend/dist/index.html'));
});

// Error handler (must be last)
app.use(errorHandler);

server.listen(config.port, () => {
  console.log(`[mc-api] 🚀 Mission Control API on http://localhost:${config.port}`);
});
