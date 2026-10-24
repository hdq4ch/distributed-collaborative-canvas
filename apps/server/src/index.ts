import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { RoomManager } from './rooms/manager';
import { setupWebSocketHandler } from './websocket/handler';
import authRouter from './auth/routes';
import boardsRouter from './boards/routes';
import { initRedis } from './redis/pubsub';

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// ─── HTTP Routes ───────────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/boards', boardsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── HTTP Server ───────────────────────────────────────────────────────────────
const httpServer = createServer(app);

// ─── WebSocket Server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });
const roomManager = new RoomManager();
setupWebSocketHandler(wss, roomManager);

// ─── Redis Pub/Sub (optional — for multi-instance scaling) ────────────────────
if (process.env.REDIS_URL) {
  initRedis();
}

// ─── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready on ws://localhost:${PORT}`);
  console.log(`🔑 Auth routes: /auth/register, /auth/login, /auth/me`);
  console.log(`📋 Board routes: /boards (CRUD)`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => process.exit(0));
});
