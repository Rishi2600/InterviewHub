# InterviewHub — Frontend

React client for the InterviewHub backend: live interview rooms with real-time
chat, and scored contests with a live leaderboard.

## Stack

| Concern      | Choice                                        |
| ------------ | --------------------------------------------- |
| Build        | Vite + React 19 + TypeScript                  |
| Routing      | react-router-dom v7                           |
| HTTP         | axios (one instance, two interceptors)        |
| Real-time    | socket.io-client v4 (`/chat`, `/leaderboard`) |
| Server state | @tanstack/react-query                         |
| Forms        | react-hook-form + zod                         |
| Styling      | Tailwind CSS v4 (tokens in `src/index.css`)   |
| Toasts       | sonner                                        |
| Icons        | lucide-react                                  |

## Running it

The backend must be running first (see the repo root). Then:

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts: `npm run build` (typecheck + production build), `npm run preview`,
`npm run lint`.

## Configuration

Copy `.env.example` to `.env`. Both values point at the backend, which serves
HTTP and WebSockets on the same origin:

```
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=http://localhost:3000
```

## How it fits together

**`src/lib/api.ts`** is the only place that knows about the backend's response
shape. A response interceptor unwraps the `{ success, data, timestamp }`
envelope so callers receive plain payloads, and normalizes errors — including
the fact that `message` arrives as a string *or* a string array — into a plain
`Error`. A 401 clears the session, which `AuthContext` observes to bounce the
user to `/login`.

Because the interceptor changes what axios resolves to, `api.ts` also exports
typed `http.get/post/patch` helpers. Use those; they encode the unwrapping in
the type system once instead of casting at every call site.

**`src/lib/endpoints.ts`** wraps every backend route the app touches, so a
contract change lands in one file.

**`src/hooks/useChatSocket.ts` / `useLeaderboardSocket.ts`** each own one
socket for the lifetime of a screen. Both re-emit their join event on *every*
`connect`, not just the first — socket.io reconnects transparently, but
server-side room membership is gone after a drop.

**Design tokens** live in the `@theme` block of `src/index.css`. Surfaces,
accent, semantic colors, type scale, radii, shadows and motion are all defined
there; components reference them and never hard-code a value.

## Notes on the backend contract

Three quirks worth knowing, all handled at the API boundary:

- **`/auth/me` returns `userId`; login/register return `user.id`.** Normalized
  into a single `User` shape in `endpoints.ts`.
- **The leaderboard payload carries no usernames** — only `{ userId, score,
  rank }`. The contest screen resolves display names from
  `GET /contests/:id/results`, whose entries do carry `username`, and falls
  back to a shortened id for anyone not yet in that roster.
- **There are no list endpoints.** Rooms and contests are reachable only by id
  or join code, so the dashboard keeps a per-user "recently visited" index in
  `localStorage` (`src/lib/recents.ts`). It is a convenience cache, not a
  source of truth — documents are always re-fetched on open.

## Structure

```
src/
  lib/          api.ts, endpoints.ts, session.ts, sockets.ts, recents.ts, utils.ts
  context/      AuthContext.tsx
  hooks/        useAuth.ts, useChatSocket.ts, useLeaderboardSocket.ts
  components/
    ui/         Button, Input, Card, Badge, Dialog, Avatar, Skeleton, States
    layout/     AppShell, ProtectedRoute, RedirectIfAuthed, FullPageLoader
    chat/       MessageList, MessageBubble, Composer, TypingIndicator,
                PinnedBanner, ParticipantsList
    contest/    Leaderboard, ScorePanel
  pages/        Login, Register, Dashboard, JoinRoom, Room, Contest, Profile, NotFound
  types/        shared API types
```