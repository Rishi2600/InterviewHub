import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'

const WS_BASE = import.meta.env.VITE_WS_BASE_URL

/**
 * The backend's WsJwtGuard reads the token from the *handshake*
 * (`handshake.auth.token`), not from a header — so it must be passed at
 * connect time, and the socket must be rebuilt when the token changes.
 */
function connect(namespace: string, token: string): Socket {
  return io(`${WS_BASE}${namespace}`, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 500,
    autoConnect: true,
  })
}

export function connectChat(token: string): Socket {
  return connect('/chat', token)
}

export function connectLeaderboard(token: string): Socket {
  return connect('/leaderboard', token)
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'