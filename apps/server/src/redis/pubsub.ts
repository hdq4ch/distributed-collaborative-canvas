import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Two Redis clients: one for publishing, one for subscribing.
 * Redis requires separate connections for pub and sub.
 */
let publisher: Redis | null = null;
let subscriber: Redis | null = null;
let enabled = false;

export function initRedis(): void {
  try {
    publisher = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
    subscriber = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });

    publisher.on('error', (err) => {
      console.warn('[Redis] Publisher error (pub/sub disabled):', err.message);
      enabled = false;
    });
    subscriber.on('error', (err) => {
      console.warn('[Redis] Subscriber error (pub/sub disabled):', err.message);
      enabled = false;
    });

    publisher.connect().then(() => {
      subscriber!.connect().then(() => {
        enabled = true;
        console.log('[Redis] Pub/Sub connected — multi-instance room sync active');
      });
    });
  } catch (err) {
    console.warn('[Redis] Failed to connect — running in single-instance mode');
  }
}

/** Publish a message to a room channel */
export function publishToRoom(roomId: string, message: string): void {
  if (!enabled || !publisher) return;
  publisher.publish(`room:${roomId}`, message).catch(() => {});
}

/** Subscribe to a room channel — callback fired on every incoming message */
export function subscribeToRoom(
  roomId: string,
  callback: (message: string) => void
): void {
  if (!enabled || !subscriber) return;
  subscriber.subscribe(`room:${roomId}`, (err) => {
    if (err) console.error(`[Redis] Subscribe error for room ${roomId}:`, err);
  });
  subscriber.on('message', (channel, message) => {
    if (channel === `room:${roomId}`) callback(message);
  });
}

export function isRedisEnabled(): boolean {
  return enabled;
}
