import { WebSocket } from 'ws';
import { DrawShape } from '../websocket/handler';

/**
 * A Room represents one shared whiteboard session.
 * It tracks all connected WebSocket clients AND the current shapes.
 */
export interface RoomClient {
  id: string;        // unique client ID (generated on connect)
  ws: WebSocket;
  userId?: string;   // set after authentication
  name?: string;     // display name for participant list
}

export class Room {
  public readonly id: string;
  private clients: Map<string, RoomClient> = new Map();
  private shapes: DrawShape[] = [];          // ← in-memory shape store
  private persistTimer?: ReturnType<typeof setTimeout>;

  constructor(id: string, initialShapes: DrawShape[] = []) {
    this.id = id;
    this.shapes = initialShapes;
  }

  addClient(client: RoomClient): void {
    this.clients.set(client.id, client);
    console.log(`[Room ${this.id}] Client ${client.id} joined. Total: ${this.clients.size}`);
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`[Room ${this.id}] Client ${clientId} left. Total: ${this.clients.size}`);
  }

  getClients(): RoomClient[] {
    return Array.from(this.clients.values());
  }

  getClientCount(): number {
    return this.clients.size;
  }

  isEmpty(): boolean {
    return this.clients.size === 0;
  }

  // ── Shape management ──────────────────────────────────────────────────────

  addShape(shape: DrawShape): void {
    this.shapes.push(shape);
  }

  getShapes(): DrawShape[] {
    return this.shapes;
  }

  clearShapes(): void {
    this.shapes = [];
  }

  setShapes(shapes: DrawShape[]): void {
    this.shapes = shapes;
  }

  /**
   * Broadcast a message to all clients in the room EXCEPT the sender.
   */
  broadcast(message: string | Buffer, excludeClientId?: string): void {
    this.clients.forEach((client) => {
      if (client.id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  /**
   * Send a message to ALL clients including the sender.
   */
  broadcastAll(message: string | Buffer): void {
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  getParticipantList(): Array<{ id: string; name: string }> {
    return Array.from(this.clients.values()).map((c) => ({
      id: c.id,
      name: c.name || `User-${c.id.slice(0, 6)}`,
    }));
  }
}

/**
 * RoomManager keeps track of all active rooms on this server instance.
 * Supports optional persistence callbacks for saving/loading shapes.
 */
export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /** Called when shapes change and need persisting (set externally) */
  onPersist?: (roomId: string, shapes: DrawShape[]) => void;

  getOrCreateRoom(roomId: string, initialShapes: DrawShape[] = []): Room {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Room(roomId, initialShapes));
      console.log(`[RoomManager] Created room: ${roomId}`);
    }
    return this.rooms.get(roomId)!;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
    console.log(`[RoomManager] Deleted empty room: ${roomId}`);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getAllRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  /** Schedule a debounced persist (2s) after a shape change */
  schedulePersist(roomId: string): void {
    const room = this.getRoom(roomId);
    if (!room || !this.onPersist) return;
    // Debounce: cancel any existing timer for this room
    clearTimeout((room as unknown as Record<string, ReturnType<typeof setTimeout>>)['_persistTimer']);
    (room as unknown as Record<string, ReturnType<typeof setTimeout>>)['_persistTimer'] = setTimeout(() => {
      this.onPersist?.(roomId, room.getShapes());
    }, 2000); // persist 2s after last change
  }
}
