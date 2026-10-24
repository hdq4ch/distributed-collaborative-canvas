# 🎨 Real-Time Collaborative Whiteboard

A high-performance, full-stack collaborative whiteboard platform built with modern TypeScript, WebSockets, Redis, and Next.js. Supports multi-user drawing, shapes, text, live cursor telemetries, and distributed cross-server synchronization.

---

## ⚡ Tech Stack & Architecture

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, HTML5 Canvas 2D API.
- **Backend:** Node.js, Express, `ws` (Native WebSockets), TypeScript (`tsx`).
- **Real-Time & Sync:**
  - In-memory room multiplexing and event broadcasting.
  - Redis Pub/Sub for horizontal scaling across multiple server instances.
  - Live cursor sharing with throttled telemetry (~25 FPS).
- **Database & Persistence:** PostgreSQL 16, Prisma ORM (debounced binary state persistence, JWT authentication).
- **Testing:** `k6` automated load & concurrency test suite.

---

## 📁 Project Structure

```text
├── apps/
│   ├── server/                  # WebSocket & REST API backend (Node.js/Express)
│   │   └── src/
│   │       ├── auth/            # Auth routes (register, login, me)
│   │       ├── boards/          # Board management CRUD
│   │       ├── db/              # Prisma client singleton
│   │       ├── middleware/      # JWT auth guard
│   │       ├── redis/           # Redis Pub/Sub client
│   │       ├── rooms/           # In-memory room manager
│   │       ├── websocket/       # WebSocket handler & message routing
│   │       └── index.ts         # Server entry point
│   │
│   └── web/                     # Frontend client (Next.js 16)
│       ├── app/                 # Next.js App Router ([roomId] dynamic page)
│       ├── components/          # Canvas, Toolbar, Whiteboard, Participants
│       └── hooks/               # useWebSocket custom hook
│
├── prisma/
│   └── schema.prisma            # Database models (User, Board, BoardMember)
├── tests/
│   └── load/                    # k6 concurrency and stress tests
├── docker-compose.yml           # Local PostgreSQL & Redis infrastructure
└── .env.example                 # Environment variables template
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Docker & Docker Compose (for PostgreSQL and Redis)
- Git

### 2. Setup Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Spin up Database & Redis
```bash
docker-compose up -d
```

### 4. Install Dependencies
```bash
# Install backend dependencies
cd apps/server
npm install

# Run database migrations
npx prisma migrate dev

# Install frontend dependencies
cd ../web
npm install
```

### 5. Run the Application

**Terminal 1 — Backend Server:**
```bash
cd apps/server
npm run dev
# Server running on http://localhost:4000 (ws://localhost:4000)
```

**Terminal 2 — Frontend Client:**
```bash
cd apps/web
npm run dev
# Web app running on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Create a board or join an existing room ID.

---

## 🧪 Concurrency & Load Testing

Simulate 200+ concurrent users with automated drawing and WebSocket message delivery using `k6`:

```bash
# Install k6 (Windows)
winget install k6

# Run concurrency load test
k6 run tests/load/concurrency-test.js
```

---

## 📄 License
MIT
