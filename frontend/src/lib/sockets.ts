import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { getFreshToken } from './api'

const WS_BASE = import.meta.env.VITE_WS_BASE_URL

/**
 * The backend's WsJwtGuard reads the token from the *handshake*
 * (`handshake.auth.token`), not from a header. Passing a function makes
 * socket.io ask for a fresh token on every connect and reconnect, so the
 * socket outlives the 15-minute access token.
 */
function connect(namespace: string): Socket {
  return io(`${WS_BASE}${namespace}`, {
    auth: (cb) => {
      void getFreshToken().then((token) => cb({ token }))
    },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 500,
    autoConnect: true,
  })
}

export function connectChat(): Socket {
  return connect('/chat')
}

export function connectContests(): Socket {
  return connect('/contests')
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'