# InterviewHub

Real-time interview and coding-contest platform. NestJS 11 + MongoDB (Mongoose)
+ Socket.io, with **optional** Redis (Socket.io adapter + sorted-set
leaderboard). It runs fully in-memory with no Redis at all, and scales to
multiple instances when Redis is turned on.

## Stack

- NestJS 11 (TypeScript, modular monolith)
- MongoDB Atlas / local via Mongoose
- Socket.io via `@nestjs/websockets`
- Redis (optional) via ioredis + `@socket.io/redis-adapter`
- JWT auth (`@nestjs/jwt` + Passport), bcrypt hashing
- Multer uploads (disk storage; Base64 contrast endpoint kept for learning)
- class-validator / class-transformer with a global ValidationPipe
- Joi-validated environment config
- Frontend: plain HTML + vanilla JS (3 pages), Socket.io client via CDN

## Quick start

```bash
npm install
cp .env.example .env      # then edit MONGODB_URI and JWT_SECRET
npm run start:dev
```

Open http://localhost:3000 — the frontend is served from `public/`.

- Requires MongoDB (local `mongodb://127.0.0.1:27017/interviewhub`, or Atlas).
- Redis is **off by default** (`REDIS_ENABLED=false`). The app is fully
  functional this way. To enable it, set `REDIS_ENABLED=true` and `REDIS_URL`.

## Modules

| Module | Responsibility |
| --- | --- |
| Auth | register / login / JWT issuance, JwtStrategy, `/auth/me` |
| Users | user schema + the only service that queries the users collection; avatar upload (disk + Base64) |
| Rooms | embedded participants, 5-char join code, `waiting -> active -> ended` state machine, pin/unpin question |
| Chat | Message schema (compound index `{roomId, createdAt}`), `ChatGateway` (join/leave, send, typing, question pin), history on join, system messages |
| Contests | Contest + ContestEntry schemas; create/activate/join/score/end; on end, final scores synced to Mongo via `bulkWrite` |
| Leaderboard | Redis sorted sets **or** in-memory Map; `LeaderboardGateway` broadcasts `leaderboard:update` |
| common | `JwtAuthGuard`, `WsJwtGuard`, `RolesGuard`, `RoomOwnerGuard`, `SelfGuard`, `@Roles()`, `@CurrentUser()`, exception filters, response interceptor |

## HTTP API (all JSON, `{ success, data, timestamp }` envelope)

Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
Users: `GET /users/:id`, `POST /users/:id/avatar` (disk), `POST /users/:id/avatar/base64`
Rooms: `POST /rooms`, `GET /rooms/:id`, `POST /rooms/:code/join`, `PATCH /rooms/:id/state`, `PATCH /rooms/:id/pin`, `PATCH /rooms/:id/unpin`
Contests: `POST /contests`, `GET /contests/:id`, `GET /contests/:id/results`, `POST /:id/activate`, `POST /:id/join`, `POST /:id/score`, `POST /:id/end`
Health: `GET /health`

Protected routes need `Authorization: Bearer <token>`.

## WebSocket

- Namespace `/chat`: `room:join`, `room:leave`, `chat:send`, `chat:typing`,
  `chat:stop_typing`, `question:pin`, `question:unpin`
  (out: `chat:history`, `chat:message`, `chat:system`, `chat:typing`,
  `chat:stop_typing`, `question:pinned`, `question:unpinned`)
- Namespace `/leaderboard`: `leaderboard:join`, `leaderboard:leave`
  (out: `leaderboard:update`)

Both authenticate the JWT on the handshake via `WsJwtGuard`
(`auth.token`, `Authorization` header, or `?token=`).

## Design decisions

- **Modular monolith** over microservices — one process, cleanly separated modules.
- **Redis scoped to two jobs only** — Socket.io scaling adapter + leaderboard
  sorted sets — and made optional with an in-memory fallback behind an identical API.
- **Denormalized `senderName`** in messages so history loads never populate user refs.
- **Avatars as a disk path string**, not bytes in Mongo; files served by static middleware.
- **Guard chain** runs auth -> role -> ownership; each layer only runs if the prior passed.

## Tests

```bash
npm test            # unit (includes in-memory leaderboard spec)
npm run test:e2e    # e2e (health)
```

## Roadmap (not yet built)

- Custom pipes (e.g. ParseMongoId), broader interceptors
- Redis caching layer (`@nestjs/cache-manager`) with TTL + invalidation
- Remove Base64 avatar path (C1); upgrade uploads to S3 via `multer-s3` (C2)
- JWT logout via Redis `jti` blacklist / refresh tokens
- Question bank (P1), session summary + PDF export (P2), notifications (P3)
- Production deploy: Dockerfile, Railway/Fly.io, managed Redis + S3 (P4)
