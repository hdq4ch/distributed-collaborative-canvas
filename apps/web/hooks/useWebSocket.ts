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
  onMessageRef.current = onMessage; // always use latest version without re-subscribing

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);

      // Join the room immediately after connecting
      ws.send(JSON.stringify({ type: 'join', roomId, userName }));
    };

    ws.onmessage = (event) => {
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
      console.log('[WS] Disconnected. Reconnecting in 3s...');
      setConnected(false);
      // Auto-reconnect after 3 seconds
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }, [url, roomId, userName]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((message: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send — not connected');
    }
  }, []);

  return { connected, clientId, send };
}
