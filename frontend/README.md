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
| UI           | shadcn/ui (new-york) on Radix, Tailwind CSS v4 |
| Toasts       | sonner (through shadcn's `Toaster`)           |
| Icons        | lucide-react                                  |
| Tests        | Vitest + Testing Library (jsdom)              |

## Running it

The backend must be running first (see the repo root). Then:

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts: `npm run build` (typecheck + production build), `npm run preview`,
`npm run lint`, `npm test` (Vitest, once) and `npm run test:watch`.

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

**Design.** Components come from shadcn/ui (`components.json`, files in
`src/components/ui/`, added with `npx shadcn@latest add <name>`). Local edits
to those files are marked with a comment at the top; the main one is that
shadows are removed, because the design uses hairline borders only.

The colour tokens are in `src/index.css`: neutral greys plus one accent,
turquoise `#14C8B4`, in a light and a dark theme. Use the token classes
(`bg-card`, `text-muted-foreground`, `bg-primary`, `text-brand` for the
accent as text, `text-danger` for red text), never raw colours. Fonts: Inter
for text, Space Grotesk for headings (`font-heading`), JetBrains Mono for
join codes.

The theme is the `dark` class on `<html>`. A script in `index.html` applies
the saved choice (or the system's) before first paint; `useTheme()` in
`src/hooks/use-theme.ts` reads and changes it.

**Page header.** The top bar belongs to `AppShell`, but each page fills it
with `<PageHeader title={…}>actions</PageHeader>`, which portals into the bar.

## Notes on the backend contract

Three quirks worth knowing, all handled at the API boundary:

- **`/auth/me` returns `userId`; login/register return `user.id`.** Normalized
  into a single `User` shape in `endpoints.ts`.
- **The leaderboard payload carries no usernames** — only `{ userId, score,
  rank }`. The contest screen resolves display names from
  `GET /contests/:id/results`, whose entries do carry `username`, and falls
  back to a shortened id for anyone not yet in that roster.
- **The list endpoints are scoped to the caller.** `GET /rooms` and
  `GET /contests` return only what the current user owns or has joined, capped
  server-side. The dashboard reads them directly; there is no client-side
  "recently visited" cache any more.

## Structure

```
src/
  lib/          api.ts, endpoints.ts, session.ts, sockets.ts, utils.ts
  context/      AuthContext.tsx
  hooks/        useAuth, useChatSocket, useLeaderboardSocket, useLiveNow,
                useCopy, use-theme, use-mobile
  components/
    ui/         shadcn/ui components (generated, then lightly edited)
    common/     UserAvatar, StatusBadge, MetricStrip, JoinCodeInput,
                JoinCodeTiles, LiveDot, States (empty and error)
    layout/     AppShell, AppSidebar, PageHeader, CommandMenu, nav,
                ProtectedRoute, RedirectIfAuthed, FullPageLoader
    dashboard/  LiveRoomCard, LiveContestCard, RoomsTable, JoinWithCode,
                ContestsList, CreateDialog
    chat/       MessageList, MessageBubble, Composer, TypingIndicator,
                PinnedBanner, PinDialog, ParticipantsList, ConnectionStatus
    contest/    Leaderboard, ScorePanel
  pages/        Login, Register, AuthLayout, Dashboard, JoinRoom, Room,
                Contest, Profile, NotFound
  test/         test setup and helpers
  types/        shared API types
```
