# InterviewHub — Project Context

A single document covering what this project is, how the codebase is put
together, what state it is in right now, and how to run it.

**Last updated:** 2026-08-18

---

## 1. What this project is

InterviewHub is a **real-time platform for running technical interviews and
scored coding contests**. `package.json` describes it as:

> Real-time interview and contest platform backend (NestJS + MongoDB +
> Socket.io + optional Redis)

It is effectively **two products sharing one auth and user layer**:

**Interview rooms.** An interviewer creates a room and gets a 5-character join
code. Candidates join by code. Everyone in the room shares a live chat, sees
system lines when people come and go, sees typing indicators, and sees a
"pinned question" banner that the host can change for everyone at once. Rooms
move through `waiting → active → ended`.

**Contests.** A host creates a contest, activates it, and awards score deltas to
participants. A leaderboard updates live for everyone watching. Ending the
contest freezes the standings into MongoDB as permanent results. Contests move
through `draft → active → ended`.

### It is a learning project

Worth knowing up front, because it explains several design choices: the commit
history includes messages like `test: learning guards -1/-2/-3`, and until
roadmap C1 removed it, `src/users/schemas/user.schema.ts` carried a "Base64
learning contrast endpoint" kept purely to demonstrate the wrong way to store
uploads. The codebase is a deliberately broad tour of NestJS —
guards, interceptors, filters, pipes, gateways, custom decorators, Mongoose
schemas, multer, Redis — rather than a minimal solution to a business problem.

---

## 2. Architecture at a glance

```
Browser (React frontend/)
    │
    ├── HTTP  ──────────►  NestJS REST API  ──►  MongoDB (users, rooms,
    │                                             messages, contests,
    │                                             contest_entries)
    └── WebSocket ──────►  Socket.io gateways
                            ├── /chat         (rooms, messages, pins)
                            └── /leaderboard  (live scores)
                                    │
                                    └──►  Redis sorted sets  *or*  in-memory Map
```

The single most characteristic design decision in this codebase is the
**optional-Redis pattern**, described in §4.

---

## 3. Repository layout

```
interviewhub/
├── src/                    NestJS backend (the main application)
│   ├── main.ts             Bootstrap: global pipes/filters/interceptors, WS adapter
│   ├── app.module.ts       Root module: config, Mongo, throttling, static files
│   ├── app.controller.ts   GET /health
│   ├── config/             Joi .env validation
│   ├── redis/              Redis clients + Socket.io Redis adapter
│   ├── common/             Cross-cutting: guards, decorators, filters,
│   │                       interceptors, the Role enum
│   ├── auth/               Register/login/me, JWT issuing, Passport strategy
│   ├── users/              User schema + the only owner of the users collection
│   ├── rooms/              Room schema, join codes, state machine, pinning
│   ├── chat/               Message schema, chat service, /chat gateway
│   ├── contests/           Contest + entry schemas, contest lifecycle
│   └── leaderboard/        Redis/in-memory scoring, /leaderboard gateway
│
├── frontend/               React client (Vite + TS) — see §8
├── public/                 Legacy vanilla-JS frontend (see §6)
├── uploads/avatars/        Disk destination for avatar uploads (gitignored)
├── test/                   Jest e2e config + one health-controller spec
├── dist/                   Compiled backend output (gitignored)
├── .env                    Local config (gitignored)
└── .env.example            Template for .env
```

---

## 4. How the backend works

### 4.1 Request pipeline

Set up in [`src/main.ts`](src/main.ts):

- **Global `ValidationPipe`** with `whitelist: true` and `transform: true` —
  unknown body fields are stripped, payloads are instantiated as DTO classes.
- **`ResponseInterceptor`** wraps every success in
  `{ success: true, data, timestamp }`.
- **`AllExceptionsFilter`** turns every error into
  `{ statusCode, error, message, path, timestamp }`. Note `message` is a
  **string or an array of strings** — validation errors arrive as an array.
- **`ThrottlerGuard`** applied globally at 120 requests / 60s.
- **CORS** open (`origin: '*'`).

### 4.2 Auth and authorization

JWT via Passport. [`AuthService`](src/auth/auth.service.ts) hashes with bcrypt
(10 rounds) and signs `{ sub, username, email, role }`.

Three roles, in [`Role`](src/common/enums/role.enum.ts): `candidate`,
`interviewer`, `admin`. Registration defaults to `candidate`.

Authorization is a stack of small guards in
[`src/common/guards/`](src/common/guards/), each doing one thing:

| Guard            | Enforces                                                     |
| ---------------- | ------------------------------------------------------------ |
| `JwtAuthGuard`   | A valid bearer token                                          |
| `RolesGuard`     | The `@Roles(...)` metadata on the handler                     |
| `RoomOwnerGuard` | Caller created the room in `:id` (admins bypass)              |
| `SelfGuard`      | `:id` is the caller's own user id (admins bypass)             |
| `WsJwtGuard`     | JWT from the **socket handshake**, not a header               |

`WsJwtGuard` reads the token from `handshake.auth.token`, the `Authorization`
header, or `?token=`, and attaches the user to `client.data.user`.

### 4.3 The optional-Redis pattern

This is the most interesting part of the codebase.

[`RedisModule`](src/redis/redis.module.ts) provides three clients when
`REDIS_ENABLED=true` and **provides `null` when it is false**. Every consumer
must treat `null` as "Redis unavailable" and fall back to memory. Two consumers
do this:

**[`LeaderboardService`](src/leaderboard/leaderboard.service.ts)** — live scores
live in a Redis **sorted set** (`ZINCRBY` for atomic increments, `ZREVRANGE`
for ranked reads). With no Redis, an in-memory `Map<contestId, Map<userId,
score>>` provides byte-identical behaviour behind the same API. Nothing else in
the app knows which backend is active.

**[`RedisIoAdapter`](src/redis/redis-io.adapter.ts)** — a Socket.io adapter
using Redis pub/sub so WebSocket broadcasts reach clients on other server
instances. Without Redis, Socket.io's default in-memory adapter is used, which
is correct for a single instance.

The consequence: **the whole app runs with zero external dependencies beyond
MongoDB.** Redis is a scaling upgrade, not a requirement.

### 4.4 Volatile vs durable scores

[`ContestsService.end()`](src/contests/contests.service.ts) closes the loop.
While a contest runs, scores live only in the leaderboard backend (Redis or
memory). On end, the full board is flushed into the `contest_entries`
collection as `finalScore` / `finalRank` in a single `bulkWrite`, then the live
board is cleared. Fast volatile store for the live path; durable store for
results.

### 4.5 Data model

| Collection        | Notes                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| `users`           | `passwordHash`, `role`, `avatarUrl`                                           |
| `rooms`           | `code` (unique), `ownerId`, `state`, **embedded** `participants[]`, `pinnedQuestion` |
| `messages`        | `roomId`, `senderId` (null for system), **denormalized** `senderName`, `type` |
| `contests`        | `ownerId`, `state`, `endedAt`                                                 |
| `contest_entries` | `contestId` + `userId` (unique compound index), `username`, `finalScore`, `finalRank` |

Two deliberate denormalizations: `senderName` on messages (so history loads
never populate user refs) and `username` on contest entries.

### 4.6 State machines

Both are enforced server-side, not just in the UI:

- **Room:** `waiting → active | ended`, `active → ended`, `ended → ∅`
- **Contest:** `draft → active`, `active → ended`, `ended → ∅`

### 4.7 File uploads

One avatar endpoint:

- `POST /users/:id/avatar` — multer `diskStorage` writes to `./uploads/avatars`,
  only the URL goes into Mongo. Image mimetypes only, 2 MB cap.

A second endpoint, `POST /users/:id/avatar/base64`, used to sit beside it as a
deliberate "learning contrast" — it buffered uploads in RAM and stored a Base64
data URI in Mongo. It was removed under roadmap C1.

---

## 5. API and WebSocket contract

### 5.1 The response envelope

Every success: `{ "success": true, "data": <payload>, "timestamp": "..." }`
Every error: `{ "statusCode", "error", "message", "path", "timestamp" }`

`message` is a **string or string[]**. Any client must unwrap `data` in exactly
one place and handle both message shapes.

### 5.2 HTTP endpoints

**Auth**

| Method | Path             | Body                                | Returns (inside `data`)                     |
| ------ | ---------------- | ----------------------------------- | ------------------------------------------- |
| POST   | `/auth/register` | `{ username, email, password, role? }` | `{ accessToken, user: { id, username, email, role } }` |
| POST   | `/auth/login`    | `{ email, password }`               | `{ accessToken, user }`                     |
| GET    | `/auth/me`       | — (Bearer)                          | `{ userId, username, email, role }`         |

Constraints: `username` min 2, `password` min 6, `role` one of the three enum
values (defaults to `candidate`).

**Users** (Bearer)

| Method | Path                       | Notes                                     |
| ------ | -------------------------- | ----------------------------------------- |
| GET    | `/users/:id`               | Safe user (no password hash)              |
| POST   | `/users/:id/avatar`        | multipart, field `file`. Self-only.       |

**Rooms** (Bearer)

| Method | Path                  | Notes                                   |
| ------ | --------------------- | --------------------------------------- |
| POST   | `/rooms`              | Interviewer/admin only                  |
| GET    | `/rooms/:id`          | —                                       |
| POST   | `/rooms/:code/join`   | Join by 5-char code                     |
| PATCH  | `/rooms/:id/state`    | Owner only. `{ state }`                 |
| PATCH  | `/rooms/:id/pin`      | Owner only. `{ question }`              |
| PATCH  | `/rooms/:id/unpin`    | Owner only                              |

**Contests** (Bearer)

| Method | Path                     | Notes                                          |
| ------ | ------------------------ | ---------------------------------------------- |
| POST   | `/contests`              | Interviewer/admin only                         |
| GET    | `/contests/:id`          | —                                              |
| GET    | `/contests/:id/results`  | Entries sorted by `finalScore`                 |
| POST   | `/contests/:id/activate` | Owner/admin (checked in the service)           |
| POST   | `/contests/:id/join`     | Seeds the leaderboard at 0                     |
| POST   | `/contests/:id/score`    | Interviewer/admin. `{ userId, delta }`. Active only |
| POST   | `/contests/:id/end`      | Owner/admin. Flushes final scores to Mongo     |

**Health:** `GET /health` → `{ status, service, timestamp }`

### 5.3 WebSocket namespaces

Both authenticate from the **handshake** (`auth: { token }`), not a header.

**`/chat`**

| Direction | Event                | Payload                                   |
| --------- | -------------------- | ----------------------------------------- |
| →         | `room:join`          | `{ roomId }` — acks `{ ok, roomId, pinnedQuestion }` |
| →         | `room:leave`         | `{ roomId }`                              |
| →         | `chat:send`          | `{ roomId, content }`                     |
| →         | `chat:typing` / `chat:stop_typing` | `{ roomId }`                |
| →         | `question:pin` / `question:unpin`  | `{ roomId, question? }`     |
| ←         | `chat:history`       | `Message[]` (last 100, chronological)     |
| ←         | `chat:message` / `chat:system` | `Message`                       |
| ←         | `chat:typing`        | `{ userId, username }`                    |
| ←         | `chat:stop_typing`   | `{ userId }`                              |
| ←         | `question:pinned` / `question:unpinned` | `{ question }` / `{}`  |
| ←         | `error`              | `{ event, message, timestamp }`           |

**`/leaderboard`**

| Direction | Event                 | Payload                                            |
| --------- | --------------------- | -------------------------------------------------- |
| →         | `leaderboard:join`    | `{ contestId }` — server replies with current board |
| →         | `leaderboard:leave`   | `{ contestId }`                                     |
| ←         | `leaderboard:update`  | `{ contestId, top: [{ userId, score, rank }] }`     |

The server pushes `leaderboard:update` on every score change, so clients never
poll.

### 5.4 Three contract quirks

Any client has to handle these:

1. **`/auth/me` returns `userId`; login/register return `user.id`.** Same
   concept, two field names.
2. **The leaderboard payload has no usernames** — only ids. Display names must
   be resolved from `GET /contests/:id/results`, whose entries carry `username`.
3. **There are no list endpoints.** Rooms and contests are reachable only by id
   or join code. Nothing enumerates "my rooms".

---

## 6. Current state

### Git

- **Branch:** `main`, in sync with `origin/main`
  (`https://github.com/Rishi2600/InterviewHub.git`) — 0 ahead, 0 behind.
- **HEAD:** `c5a4088 remove stale readme`
- **History:** 50 commits. The original 47 remain intact; two were added to
  replace the codebase wholesale (a wipe commit followed by a re-add), then one
  more removed the stale NestJS boilerplate README. No history was ever
  rewritten — the replacement was a normal fast-forward push, so the original
  commits and their contribution record are untouched.
- **Uncommitted:** `frontend/` is **untracked**. Nothing else is dirty.

### What works

- Backend compiles and boots. Modules initialize cleanly; the in-memory
  leaderboard fallback and in-memory Socket.io adapter both activate correctly
  when `REDIS_ENABLED=false`.
- Frontend typechecks (strict), lints, and builds for production. Dev server
  serves and every module transforms without error.

### Known blockers and gaps

**Blocker — MongoDB is unreachable from this machine.** `MONGODB_URI` points at
a MongoDB Atlas cluster, and the backend fails at startup with:

```
MongooseServerSelectionError: Could not connect to any servers in your
MongoDB Atlas cluster... make sure your current IP is on your Atlas
cluster's IP whitelist
```

The fix is an Atlas dashboard change (whitelist the current IP) or pointing
`MONGODB_URI` at a local `mongod`. Until then **no runtime end-to-end
verification is possible** — that includes two-window chat, live leaderboard
updates, and the real auth loop. Everything below the API boundary has been
verified only by reading source and by compile/build checks.

**Security — see §7.** There is a cluster of authorization gaps, plus a stored
XSS chain in avatar upload. They are significant enough to have their own
section.

**Legacy frontend still served.** [`public/`](public/) holds the original
vanilla-JS client (`index.html`, `room.html`, `leaderboard.html`, `app.js`,
`styles.css`) and `app.module.ts` still serves it at `/` via
`ServeStaticModule`. It is superseded by `frontend/` but has not been removed,
so the backend root and the React dev server show different UIs.

**Test coverage is thin.** Two spec files total: a `LeaderboardService`
unit test covering the in-memory fallback, and an e2e spec that only asserts the
health controller. There are no tests for auth, guards, room/contest state
machines, or either gateway.

**`@ts-nocheck` in two files.**
[`leaderboard.gateway.ts`](src/leaderboard/leaderboard.gateway.ts) and
[`leaderboard.service.spec.ts`](src/leaderboard/leaderboard.service.spec.ts)
both open with `//@ts-nocheck`, so they are excluded from type checking.

**Stale `avatarBase64` data.** The Base64 avatar endpoint and the schema field
(roadmap C1) have been removed from the code, but `users` documents written
before the removal may still carry an `avatarBase64` value in MongoDB. Mongoose
no longer maps it, so it is inert — but the stored data (potentially large
Base64 blobs) is still on disk. No migration has been written.

---

## 7. Security findings

Found by reading the source. **None have been exploited or confirmed at
runtime** — the backend cannot start on this machine (§6) — so treat these as
code review, not a pentest. Severity is my judgement of impact if this were
deployed as-is.

This is also not a certified-complete list: it is a focused pass over auth,
authorization, upload handling and transport config, done by hand. There is no
automated scanning configured in the project.

**Dependencies are clean.** `npm audit --omit=dev` reports **0 vulnerabilities**
for both the backend and the frontend (checked 2026-08-18). Every finding below
is in this project's own code, not in a package.

### 7.1 The WebSocket gateways skip authorization entirely — **High**

This is the most serious cluster. `WsJwtGuard` proves *who* you are, but no
handler checks *what you may touch*. Every handler in
[`chat.gateway.ts`](src/chat/chat.gateway.ts) takes a `roomId` straight from
the client and acts on it.

| Event | Consequence |
| ----- | ----------- |
| `room:join` | Any authenticated user can join **any** room by id — no participant check, no join code — and immediately receives `chat:history`: the last 100 messages. **Full interview transcript disclosure.** |
| `chat:send` | Can post into any room, impersonating presence in an interview they were never invited to. Also unchecked against room state, so `ended` rooms still accept messages. |
| `question:pin` / `question:unpin` | Can pin or unpin for the whole room. The HTTP equivalent *is* guarded by `RoomOwnerGuard` ([rooms.controller.ts:51-55](src/rooms/rooms.controller.ts#L51-L55)); the socket path ([chat.gateway.ts:132-148](src/chat/chat.gateway.ts#L132-L148)) is not. |
| `leaderboard:join` | Any user can subscribe to any contest's live board. Lower impact, same root cause. |

The React client only shows host controls to owners — cosmetic only, since the
events can be emitted directly from a console.

**Fix:** a `WsRoomParticipantGuard` (is the caller in `room.participants`?) and
a `WsRoomOwnerGuard` (mirroring `RoomOwnerGuard`), applied per handler.

### 7.2 Avatar upload → stored XSS → account takeover — **High**

A genuine chain, and the one I'd fix first alongside §7.1:

1. [`users.controller.ts:51-58`](src/users/users.controller.ts#L51-L58) filters
   on `file.mimetype` — which is the **client-declared** `Content-Type` in the
   multipart part, freely forgeable.
2. The stored filename is `` `${unique}${extname(file.originalname)}` `` — the
   random prefix prevents collisions and traversal, but the **extension comes
   from the attacker**.
3. [`app.module.ts:33-43`](src/app.module.ts#L33-L43) serves `./uploads` at
   `/uploads` via `ServeStaticModule`, which sets `Content-Type` from the file
   extension.

So: upload a file declaring `Content-Type: image/png` with `originalname`
`x.html` and an HTML/JS body. It is stored as `<ts>-<rand>.html` and served
from the application's own origin as `text/html`. Any visitor to that URL
executes attacker script **on the app origin**.

`SelfGuard` limits you to your own user id, but that is no barrier — you upload
to yourself and share the resulting URL.

The payoff is total, because the frontend stores the JWT in `localStorage`
(`src/lib/session.ts`), which is readable by any script on the origin. There is
also **no CSP** (§7.5) to blunt it.

**Fix:** whitelist the extension rather than deriving it from user input
(map the validated mimetype to a fixed extension), verify magic bytes, and
serve uploads with `Content-Disposition: attachment` or from a separate origin.

### 7.3 Every read endpoint is authenticated but not authorized — **Medium**

`JwtAuthGuard` alone means "any logged-in user", which is not the same as
"anyone entitled to this record":

- `GET /users/:id` returns another user's **email** via `toSafe()`. Any account
  can harvest PII by walking ids.
- `GET /rooms/:id` returns the whole room document including the **join code**
  and the participant roster.
- `GET /contests/:id` and `/contests/:id/results` are readable by anyone.

### 7.4 JWT claims are trusted without revalidation — **Medium**

[`jwt.strategy.ts:28-35`](src/auth/strategies/jwt.strategy.ts#L28-L35) builds
`request.user` purely from the token payload and never re-reads the database.
Because `role` is baked into the token at login and `JWT_EXPIRES_IN=1d`:

- Demoting or banning a user **does not take effect for up to 24 hours**.
- A deleted user's token keeps working until it expires.
- There is no revocation list; logout is client-side only.

### 7.5 Missing transport and header hardening — **Medium**

- **No `helmet`** — no CSP, `X-Frame-Options`, `X-Content-Type-Options`, or
  HSTS. Absent CSP is what makes §7.2 fully weaponizable.
- **`enableCors({ origin: '*' })`** in [`main.ts:14`](src/main.ts#L14), and
  `cors: { origin: '*' }` on both gateways. Auth is a Bearer token rather than
  a cookie, so this is not CSRF, but it is broader than any deployment needs.

### 7.6 Rate limiting has holes — **Medium/Low**

`ThrottlerModule` is global at **120 requests / 60s**, but:

- That is very permissive for `POST /auth/login` — roughly 172,000 password
  attempts per day per IP. Auth endpoints deserve a much tighter bucket.
- **WebSocket events are not throttled at all.** `ThrottlerGuard` is an HTTP
  guard; `chat:send` can be flooded, and every message is a Mongo write.

### 7.7 Lower-severity items

| Finding | Detail |
| ------- | ------ |
| **Account enumeration on register** | `UsersService.create` throws `ConflictException('Email already registered')`, revealing which emails exist. Login correctly returns a generic `Invalid credentials`. |
| **Weak password policy** | `@MinLength(6)` only — no complexity or breach-list check. |
| **Unbounded score delta** | `ScoreDto.delta` is `@IsInt()` with no range. Host-only, so impact is low. |
| **Unvalidated id → 500** | `UsersService.findById` does not call `Types.ObjectId.isValid`, so a malformed id raises a Mongoose `CastError` and a 500 rather than a 404. Rooms and contests do validate. |
| **`@ts-nocheck`** | [`leaderboard.gateway.ts`](src/leaderboard/leaderboard.gateway.ts) and its spec are excluded from type checking, which can conceal defects. |

### 7.8 What is done correctly

Worth recording, so a future pass does not "fix" these:

- bcrypt at 10 rounds; `passwordHash` never leaves the server (`toSafe()`).
- Login returns a **generic** error for both unknown-email and wrong-password.
- Global `ValidationPipe` with `whitelist: true` strips unknown fields, and DTOs
  use `class-validator` throughout — including `@IsMongoId()` on `ScoreDto`.
- `AllExceptionsFilter` logs stack traces server-side but returns a generic
  `Internal server error` to the client.
- No NoSQL injection surface found: user input reaching Mongo queries is
  constrained to validated strings and route params.
- `MessageSchema` caps content at 2000 chars; avatar uploads at 2 MB.
- The React client never uses `dangerouslySetInnerHTML`; message content renders
  through normal JSX escaping.

### 7.9 Suggested order of work

1. Add participant/owner guards to the chat gateway (§7.1).
2. Fix the upload extension handling (§7.2).
3. Add `helmet` with a CSP (§7.5) — cheap, and it blunts §7.2.
4. Tighten the throttle on auth routes; add a WS-level rate limit (§7.6).
5. Add ownership/participation checks to the read endpoints (§7.3).
6. Re-read the user (or at least the role) on each request, or shorten token
   lifetime and add revocation (§7.4).

---

## 8. The frontend (`frontend/`)

Built from a detailed spec, as a production-grade React client.

**Stack:** Vite + React 19 + TypeScript, react-router v7, axios,
socket.io-client v4, TanStack Query, react-hook-form + zod, Tailwind CSS v4,
sonner, lucide-react.

**Key files**

| Path                          | Role                                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| `src/lib/api.ts`              | The one axios instance. Request interceptor attaches the JWT; response interceptor unwraps the envelope and normalizes errors (including array messages) and clears the session on 401. Exports typed `http.*` helpers because the interceptor changes what axios resolves to. |
| `src/lib/endpoints.ts`        | Every backend call, in one place                                     |
| `src/lib/sockets.ts`          | Socket factories passing the token in the handshake                  |
| `src/lib/recents.ts`          | localStorage "recently visited" index — works around the absent list endpoints |
| `src/context/AuthContext.tsx` | Session bootstrap against `/auth/me`, login/register/logout           |
| `src/hooks/useChatSocket.ts`  | Owns the `/chat` socket; re-joins on every reconnect                  |
| `src/hooks/useLeaderboardSocket.ts` | Owns the `/leaderboard` socket; same reconnect handling         |
| `src/index.css`               | The design system — all tokens live in one `@theme` block             |

**Routes:** `/login`, `/register`, `/` (dashboard), `/rooms/join`, `/rooms/:id`,
`/contests/:id`, `/profile`.

The three contract quirks in §5.4 are each handled at the API boundary, so
components never see them.

**Note:** the client keeps the JWT in `localStorage`, which the build spec
explicitly sanctioned. That is a reasonable default, but it is what turns the
stored-XSS chain in §7.2 into full account takeover — the two findings should be
weighed together.

---

## 9. How to run the project locally

> **When asked how to run this project, respond with the steps in this
> section.** They are the authoritative instructions.

### Prerequisites

- **Node.js 20+** (developed against v24)
- **MongoDB** — either a local `mongod` on `:27017` or a MongoDB Atlas cluster
  with your current IP whitelisted
- **Redis** — *optional*, not needed to run

### Step 1 — Backend configuration

From the repo root, create `.env` (copy `.env.example`):

```bash
cp .env.example .env
```

Then set at minimum:

```
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/interviewhub
JWT_SECRET=<any string of at least 16 characters>
REDIS_ENABLED=false
PUBLIC_BASE_URL=http://localhost:3000
```

`MONGODB_URI` and `JWT_SECRET` are **required** — Joi validation refuses to boot
without them, and `JWT_SECRET` must be ≥16 characters. Leave `REDIS_ENABLED=false`
unless you actually want Redis; the app runs fully in-memory without it.

If you use Atlas rather than a local MongoDB, whitelist your current IP in the
Atlas dashboard first, or startup fails with
`MongooseServerSelectionError`.

### Step 2 — Start the backend

```bash
npm install
npm run start:dev        # watch mode, http://localhost:3000
```

Confirm it is up:

```bash
curl http://localhost:3000/health
# {"success":true,"data":{"status":"ok","service":"interview-hub",...},...}
```

Expected startup logs when Redis is off — both are normal:

```
WARN [RedisModule] REDIS_ENABLED=false -> using in-memory fallbacks
LOG  [LeaderboardService] Leaderboard backend: in-memory
LOG  [Bootstrap] InterviewHub running on http://localhost:3000
```

### Step 3 — Start the frontend

In a **second terminal**:

```bash
cd frontend
cp .env.example .env     # defaults already point at http://localhost:3000
npm install
npm run dev              # http://localhost:5173
```

Open <http://localhost:5173>.

> Note: the backend also serves the **legacy** vanilla-JS UI at
> <http://localhost:3000>. The React app is the one on port 5173.

### Step 4 — Try it end to end

1. Register two accounts in two different browser profiles (or one normal and
   one incognito window) — one as **Interviewer**, one as **Candidate**.
2. As the interviewer, create a room from the dashboard and copy the
   5-character join code.
3. As the candidate, go to **Join room** and enter the code.
4. Send messages in both windows — they should appear in real time, along with
   system join lines and typing indicators.
5. As the interviewer, pin a question — the banner updates for both windows.
6. Create a contest, **Activate** it, have the candidate **Join**, then award
   points. The leaderboard updates live in both windows.
7. **End** the contest to freeze the final standings.

### Optional — enable Redis

Only needed to run multiple backend instances or to use the sorted-set
leaderboard:

```
REDIS_ENABLED=true
REDIS_URL=redis://127.0.0.1:6379
```

Startup then logs `Leaderboard backend: Redis` and
`Socket.io Redis adapter enabled`.

### Useful commands

**Backend** (repo root)

| Command             | Does                                    |
| ------------------- | --------------------------------------- |
| `npm run start:dev` | Watch mode                              |
| `npm run start:prod`| Run the compiled build (`dist/main`)    |
| `npm run build`     | Compile to `dist/`                      |
| `npm test`          | Jest unit tests                         |
| `npm run test:e2e`  | e2e suite                               |
| `npm run lint`      | ESLint with `--fix`                     |

**Frontend** (`frontend/`)

| Command           | Does                                |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Dev server on :5173                 |
| `npm run build`   | Typecheck + production build        |
| `npm run preview` | Serve the production build          |
| `npm run lint`    | oxlint                              |

### Troubleshooting

| Symptom                                                    | Cause and fix                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `MongooseServerSelectionError ... IP whitelist`            | Atlas is blocking this machine. Whitelist your IP, or point `MONGODB_URI` at a local `mongod`. |
| App refuses to boot, complains about a config value         | Joi validation. `MONGODB_URI` is required and `JWT_SECRET` must be ≥16 chars.  |
| Frontend loads but every request fails                      | Backend is not running, or `VITE_API_BASE_URL` does not match its port.        |
| Logged out immediately after signing in                     | A 401 clears the session. Usually a `JWT_SECRET` change invalidating old tokens — sign in again. |
| Chat connects but no messages arrive                        | Socket auth is in the handshake. Confirm a token exists and the room was joined. |
| Leaderboard shows ids instead of names                      | The board carries ids only; names come from `/contests/:id/results`. The user must have **joined** the contest to appear there. |
| Avatar uploads succeed but images 404                       | `PUBLIC_BASE_URL` must match where the server is actually reachable.           |

---

## 10. Suggested next steps

Roughly in priority order:

1. **Work through the security findings in §7**, starting with the WebSocket
   authorization gaps (§7.1) and the avatar-upload XSS chain (§7.2).
2. **Unblock MongoDB** so the app can actually be exercised end to end.
3. **Decide the fate of `public/`** — delete it and the `ServeStaticModule`
   entry for it, or keep it deliberately.
4. **Remove the two `@ts-nocheck` pragmas** and fix the underlying types.
5. **Add tests** for guards, both state machines, and the gateways.
6. **Add list endpoints** (`GET /rooms`, `GET /contests`) so clients need not
   keep a localStorage index.
7. **Commit `frontend/`.**