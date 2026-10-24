'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Canvas, { DrawShape, Tool } from '../components/Canvas';
import Toolbar from '../components/Toolbar';
import Participants from '../components/Participants';
import { useWebSocket, WsMessage } from '../hooks/useWebSocket';

interface WhiteboardProps {
  roomId: string;
  userName?: string;
}

interface RemoteCursor {
  x: number;
  y: number;
  name: string;
}

// Colour palette for remote cursors — cycles by clientId index
const CURSOR_COLORS = [
  '#3b82f6', '#22c55e', '#f97316', '#ec4899',
  '#8b5cf6', '#14b8a6', '#ef4444', '#eab308',
];

/**
 * Whiteboard is the "orchestrator" component.
 * It wires together:
 *   - Canvas        (draws shapes)
 *   - Toolbar       (selects tools / colors)
 *   - WebSocket     (sends/receives from other users)
 *   - Participants  (shows who's online)
 *   - Cursor overlay (shows other users' cursors in real-time)
 */
export default function Whiteboard({ roomId, userName = 'Guest' }: WhiteboardProps) {
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [history, setHistory] = useState<DrawShape[][]>([[]]); // undo/redo stack
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Throttle cursor sends — max one per 40ms (~25 fps)
  const lastCursorSend = useRef(0);

  // ── WebSocket message handler ──────────────────────────────────────────────
  const handleWsMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {

      case 'joined': {
        const list = msg.participants as Array<{ id: string; name: string }>;
        setParticipants(list);
        break;
      }

      case 'initial-state': {
        // Server sends existing board shapes when we first join
        const incoming = msg.shapes as DrawShape[];
        setShapes(incoming);
        setHistory([incoming]);
        setHistoryIndex(0);
        break;
      }

      case 'user-joined': {
        setParticipants((prev) => [
          ...prev,
          { id: msg.clientId as string, name: msg.name as string },
        ]);
        break;
      }

      case 'user-left': {
        const leftId = msg.clientId as string;
        setParticipants((prev) => prev.filter((p) => p.id !== leftId));
        // Remove their cursor
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.delete(leftId);
          return next;
        });
        break;
      }

      case 'draw': {
        // Another user drew something — append to our shapes
        const remoteShape = msg.payload as DrawShape;
        setShapes((prev) => [...prev, remoteShape]);
        break;
      }

      case 'clear': {
        // Another user (or server broadcast) cleared the board
        setShapes([]);
        setHistory([[]]);
        setHistoryIndex(0);
        break;
      }

      case 'cursor': {
        // Update remote cursor position
        const { clientId, x, y } = msg as { type: string; clientId: string; x: number; y: number };
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          const participant = participants.find((p) => p.id === clientId);
          next.set(clientId, { x, y, name: participant?.name || clientId.slice(0, 6) });
          return next;
        });
        break;
      }
    }
  }, [participants]);

  const { connected, clientId, send } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000',
    roomId,
    userName,
    onMessage: handleWsMessage,
  });

  // ── Shape added by local user ──────────────────────────────────────────────
  const handleShapeAdded = useCallback((shape: DrawShape) => {
    const newShapes = [...shapes, shape];
    setShapes(newShapes);

    // Update undo history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newShapes);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Broadcast to peers
    send({ type: 'draw', roomId, payload: shape });
  }, [shapes, history, historyIndex, send, roomId]);

  // ── Undo ──────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setShapes(history[newIndex]);
    }
  }, [historyIndex, history]);

  // ── Redo ──────────────────────────────────────────────────────────────────
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setShapes(history[newIndex]);
    }
  }, [historyIndex, history]);

  // ── Clear ──────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setShapes([]);
    setHistory([[]]);
    setHistoryIndex(0);
    // Broadcast clear to all peers via server
    send({ type: 'clear', roomId });
  }, [send, roomId]);

  // ── Export as PNG ──────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [roomId]);

  // ── Send cursor position (throttled to ~25 fps) ───────────────────────────
  const handleCursorMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastCursorSend.current < 40) return;
    lastCursorSend.current = now;

    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    send({ type: 'cursor', roomId, x, y });
  }, [send, roomId]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') handleUndo();
      if (e.ctrlKey && e.key === 'y') handleRedo();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleUndo, handleRedo]);

  // ── Get colour for a given remote cursor ──────────────────────────────────
  const cursorColorFor = (id: string) => {
    const idx = participants.findIndex((p) => p.id === id);
    return CURSOR_COLORS[(idx >= 0 ? idx : 0) % CURSOR_COLORS.length];
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar: participants */}
      <Participants
        participants={participants}
        currentClientId={clientId}
        connected={connected}
        roomId={roomId}
      />

      {/* Toolbar */}
      <Toolbar
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        onToolChange={setTool}
        onColorChange={setColor}
        onStrokeWidthChange={setStrokeWidth}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onExport={handleExport}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />

      {/* Canvas area + cursor overlay */}
      <div
        ref={canvasAreaRef}
        className="flex-1 overflow-hidden bg-white shadow-inner relative"
        onMouseMove={handleCursorMove}
      >
        <Canvas
          tool={tool}
          color={color}
          strokeWidth={strokeWidth}
          shapes={shapes}
          onShapeAdded={handleShapeAdded}
        />

        {/* Remote cursor overlays */}
        {Array.from(remoteCursors.entries()).map(([id, cursor]) => (
          <div
            key={id}
            className="pointer-events-none absolute flex flex-col items-start"
            style={{ left: cursor.x, top: cursor.y, transform: 'translate(2px, 2px)' }}
          >
            {/* Cursor arrow */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 2L14 7L8 9L6 14L2 2Z"
                fill={cursorColorFor(id)}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <span
              className="text-white text-xs px-1.5 py-0.5 rounded-md mt-0.5 whitespace-nowrap font-medium shadow"
              style={{ backgroundColor: cursorColorFor(id), fontSize: 11 }}
            >
              {cursor.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
