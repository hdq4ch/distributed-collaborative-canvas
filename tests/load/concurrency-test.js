/**
 * TEST 1: Concurrency Test
 * Simulates many users joining the same room at once
 * Run: k6 run tests/load/concurrency-test.js
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// ── Custom Metrics ──────────────────────────────────────────────────────────
const messageLatency   = new Trend('ws_message_latency_ms');   // how fast msgs arrive
const drawsReceived    = new Counter('draws_received');         // total draws received
const connectionErrors = new Counter('connection_errors');      // failed connections
const messageSuccessRate = new Rate('message_success_rate');    // % of successful msgs

// ── Test Configuration ──────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10  },   // ramp up to 10 users
    { duration: '1m',  target: 50  },   // ramp up to 50 users
    { duration: '2m',  target: 100 },   // hold 100 concurrent users
    { duration: '30s', target: 200 },   // spike to 200 users
    { duration: '1m',  target: 100 },   // scale back down
    { duration: '30s', target: 0   },   // ramp down to 0
  ],
  thresholds: {
    // PASS/FAIL criteria:
    'ws_message_latency_ms': ['p95<200'],      // 95% of messages < 200ms
    'message_success_rate':  ['rate>0.95'],    // 95% messages must succeed
    'connection_errors':     ['count<10'],     // less than 10 connection errors
  },
};

const WS_URL  = __ENV.WS_URL  || 'ws://localhost:4000';
const ROOM_ID = __ENV.ROOM_ID || 'load-test-room';

export default function () {
  const userName = `LoadUser-${__VU}`; // __VU = virtual user number

  const res = ws.connect(`${WS_URL}`, {}, function (socket) {

    socket.on('open', () => {
      // Join the room
      socket.send(JSON.stringify({
        type: 'join',
        roomId: ROOM_ID,
        userName,
      }));
    });

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'joined') {
          console.log(`VU ${__VU}: Joined room with ${msg.participants.length} participants`);

          // Start drawing after joining
          drawContinuously(socket);
        }

        if (msg.type === 'draw') {
          drawsReceived.add(1);
          messageSuccessRate.add(true);
        }

        if (msg.type === 'error') {
          messageSuccessRate.add(false);
          console.error(`VU ${__VU}: Error - ${msg.message}`);
        }

      } catch (e) {
        messageSuccessRate.add(false);
      }
    });

    socket.on('error', (e) => {
      connectionErrors.add(1);
      console.error(`VU ${__VU}: WebSocket error - ${e.error()}`);
    });

    // Keep connection alive for test duration
    socket.setTimeout(() => socket.close(), 180000); // 3 minutes
  });

  check(res, { 'WebSocket connected': (r) => r && r.status === 101 });
}

function drawContinuously(socket) {
  // Simulate a user drawing every 500ms
  let drawCount = 0;
  const interval = socket.setInterval(() => {
    if (drawCount > 20) {
      socket.clearInterval(interval);
      return;
    }

    const sentAt = Date.now();

    socket.send(JSON.stringify({
      type: 'draw',
      roomId: ROOM_ID,
      payload: {
        id: `shape-${__VU}-${drawCount}`,
        tool: 'pen',
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
        strokeWidth: 4,
        points: [
          { x: Math.random() * 800, y: Math.random() * 600 },
          { x: Math.random() * 800, y: Math.random() * 600 },
          { x: Math.random() * 800, y: Math.random() * 600 },
        ],
      },
    }));

    drawCount++;
    sleep(0.5); // 500ms between draws
  }, 500);
}
