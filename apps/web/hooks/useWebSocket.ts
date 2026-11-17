'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * LEARNING NOTE:
 * This is a custom React hook for the WebSocket connection.
 * By extracting it into a hook, the Whiteboard component stays clean.
 *
 * The hook:
 * 1. Opens a WebSocket connection to the server
 * 2. Joins the specified room
 * 3. Listens for incoming messages from other users
 * 4. Provides a `send` function to send messages
 */

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  url: string;
  roomId: string;
  userName: string;
  onMessage: (msg: WsMessage) => void;
}

export function useWebSocket({ url, roomId, userName, onMessage }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string | undefined>();
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let disposed = false;
    const connect = () => {
      if (disposed) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed || wsRef.current !== ws) return;
        console.log('[WS] Connected');
        setConnected(true);

        // Join the room immediately after connecting
        ws.send(JSON.stringify({ type: 'join', roomId, userName }));
      };

      ws.onmessage = (event) => {
        if (disposed || wsRef.current !== ws) return;
        try {
          const msg: WsMessage = JSON.parse(event.data);

          // If we just joined, capture our client ID
          if (msg.type === 'joined') {
            setClientId(msg.clientId as string);
          }

          onMessageRef.current(msg);
        } catch (err) {
          console.error('[WS] Failed to parse message', err);
        }
      };

      ws.onclose = () => {
        if (disposed || wsRef.current !== ws) return;
        wsRef.current = null;
        console.log('[WS] Disconnected. Reconnecting in 3s...');
        setConnected(false);
        // Auto-reconnect after 3 seconds
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        // In browser standard WebSocket, ErrorEvent doesn't expose detailed properties.
        // This happens when the server at `url` is unreachable or closed.
        console.warn(`[WS] Connection failed to ${url}. Make sure the backend server is running on port 4000.`);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer.current);
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [url, roomId, userName]);

  const send = useCallback((message: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send — not connected');
    }
  }, []);

  return { connected, clientId, send };
}
