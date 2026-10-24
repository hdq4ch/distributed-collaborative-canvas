import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { RoomManager } from '../rooms/manager';
import { prisma } from '../db/prisma';
import { v4 as uuidv4 } from 'uuid';

/**
 * Message types that flow between client and server.
 */
export type DrawPayload = {
  id: string;
  tool: 'pen' | 'line' | 'rectangle' | 'circle' | 'eraser' | 'text';
  points?: Array<{ x: number; y: number }>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  color: string;
  strokeWidth: number;
};

export type DrawShape = DrawPayload; // alias for clarity

export type ClientMessage =
  | { type: 'join'; roomId: string; userName?: string }
  | { type: 'draw'; roomId: string; payload: DrawPayload }
  | { type: 'clear'; roomId: string }
  | { type: 'yjs-update'; roomId: string; update: number[] }
  | { type: 'cursor'; roomId: string; x: number; y: number }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'joined'; roomId: string; clientId: string; participants: Array<{ id: string; name: string }> }
  | { type: 'initial-state'; shapes: DrawShape[] }
  | { type: 'user-joined'; clientId: string; name: string }
  | { type: 'user-left'; clientId: string }
  | { type: 'draw'; clientId: string; payload: DrawPayload }
  | { type: 'clear'; clientId: string }
  | { type: 'yjs-update'; clientId: string; update: number[] }
  | { type: 'cursor'; clientId: string; x: number; y: number }
  | { type: 'pong' }
  | { type: 'error'; message: string };

/** Helper to load saved shapes for a board from the DB */
async function loadBoardShapes(roomId: string): Promise<DrawShape[]> {
  try {
    const board = await prisma.board.findFirst({
      where: { id: roomId },
      select: { yjsState: true },
    });
    if (board?.yjsState) {
      return JSON.parse(board.yjsState.toString('utf-8')) as DrawShape[];
    }
  } catch (err) {
    console.error(`[DB] Failed to load shapes for room ${roomId}:`, err);
  }
  return [];
}

/** Helper to persist shapes for a board to the DB */
async function saveBoardShapes(roomId: string, shapes: DrawShape[]): Promise<void> {
  try {
    await prisma.board.upsert({
      where: { id: roomId },
      update: { yjsState: Buffer.from(JSON.stringify(shapes), 'utf-8') },
      create: {
        id: roomId,
        name: `Board ${roomId}`,
        ownerId: 'anonymous', // replaced when auth is integrated
        yjsState: Buffer.from(JSON.stringify(shapes), 'utf-8'),
      },
    });
  } catch (err) {
    // Silently ignore — persistence is best-effort
    // (e.g. anonymous boards with no owner FK won't persist)
  }
}

export function setupWebSocketHandler(wss: WebSocketServer, roomManager: RoomManager): void {
  // Wire up the persistence callback
  roomManager.onPersist = (roomId, shapes) => {
    saveBoardShapes(roomId, shapes);
  };

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const clientId = uuidv4();
    let currentRoomId: string | null = null;

    console.log(`[WS] New connection: ${clientId}`);

    ws.on('message', async (rawData) => {
      try {
        const message: ClientMessage = JSON.parse(rawData.toString());

        switch (message.type) {

          case 'ping': {
            send(ws, { type: 'pong' });
            break;
          }

          case 'join': {
            const { roomId, userName } = message;

            // Load saved shapes from DB if this is a fresh room
            const existingRoom = roomManager.getRoom(roomId);
            let initialShapes: DrawShape[] = [];
            if (!existingRoom) {
              initialShapes = await loadBoardShapes(roomId);
            }

            const room = roomManager.getOrCreateRoom(roomId, initialShapes);
            currentRoomId = roomId;
            room.addClient({ id: clientId, ws, name: userName });

            // Tell the new user: joined + current participants
            send(ws, {
              type: 'joined',
              roomId,
              clientId,
              participants: room.getParticipantList(),
            });

            // Send existing board state to the new user
            const shapes = room.getShapes();
            if (shapes.length > 0) {
              send(ws, { type: 'initial-state', shapes });
            }

            // Tell everyone else in the room a new user joined
            room.broadcast(
              JSON.stringify({
                type: 'user-joined',
                clientId,
                name: userName || `User-${clientId.slice(0, 6)}`,
              } satisfies ServerMessage),
              clientId,
            );
            break;
          }

          case 'draw': {
            if (!currentRoomId) {
              send(ws, { type: 'error', message: 'Join a room first' });
              return;
            }
            const room = roomManager.getRoom(currentRoomId);
            if (!room) return;

            // Store shape in room memory
            room.addShape(message.payload);

            // Schedule a debounced DB persist
            roomManager.schedulePersist(currentRoomId);

            // Relay to all OTHER clients
            room.broadcast(
              JSON.stringify({
                type: 'draw',
                clientId,
                payload: message.payload,
              } satisfies ServerMessage),
              clientId,
            );
            break;
          }

          case 'clear': {
            if (!currentRoomId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (!room) return;

            room.clearShapes();
            roomManager.schedulePersist(currentRoomId);

            // Broadcast clear to ALL clients (including sender)
            room.broadcastAll(
              JSON.stringify({ type: 'clear', clientId } satisfies ServerMessage)
            );
            break;
          }

          case 'yjs-update': {
            if (!currentRoomId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (!room) return;
            room.broadcast(
              JSON.stringify({
                type: 'yjs-update',
                clientId,
                update: message.update,
              } satisfies ServerMessage),
              clientId,
            );
            break;
          }

          case 'cursor': {
            if (!currentRoomId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (!room) return;
            room.broadcast(
              JSON.stringify({
                type: 'cursor',
                clientId,
                x: message.x,
                y: message.y,
              } satisfies ServerMessage),
              clientId,
            );
            break;
          }

          default:
            send(ws, { type: 'error', message: 'Unknown message type' });
        }
      } catch (err) {
        console.error(`[WS] Failed to parse message from ${clientId}:`, err);
        send(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${clientId}`);
      if (currentRoomId) {
        const room = roomManager.getRoom(currentRoomId);
        if (room) {
          room.removeClient(clientId);
          room.broadcast(
            JSON.stringify({ type: 'user-left', clientId } satisfies ServerMessage),
          );
          if (room.isEmpty()) {
            roomManager.deleteRoom(currentRoomId);
          }
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for client ${clientId}:`, err.message);
    });
  });
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
