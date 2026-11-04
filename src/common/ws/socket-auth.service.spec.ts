import { EventEmitter } from 'events';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { SocketAuthService } from './socket-auth.service';
import { MAX_SOCKETS_PER_USER } from '../throttle/limits';

const PAYLOAD = { sub: 'u1', username: 'ada', email: 'a@x.io', role: 'admin' };

function service(verify: (token: string) => unknown = () => PAYLOAD) {
  const jwt = { verify } as unknown as JwtService;
  const config = { get: () => 'secret' } as unknown as ConfigService;
  return new SocketAuthService(jwt, config);
}

/** A fake socket: an emitter with a handshake, a namespace and data. */
function fakeSocket(token?: string, nsp = '/chat') {
  const data: { user?: unknown } = {};
  return Object.assign(new EventEmitter(), {
    handshake: { auth: token ? { token } : {}, headers: {}, query: {} },
    nsp: { name: nsp },
    data,
  });
}

/** Runs the middleware; resolves to the error message, or null if accepted. */
function connect(
  svc: SocketAuthService,
  socket: ReturnType<typeof fakeSocket>,
) {
  let result: string | null = 'not called';
  svc.middleware()(socket as unknown as Socket, (err) => {
    result = err ? err.message : null;
  });
  return result;
}

describe('SocketAuthService', () => {
  it('refuses a connection with no token', () => {
    expect(connect(service(), fakeSocket())).toBe(
      'Missing authentication token',
    );
  });

  it('refuses a token that does not verify', () => {
    const svc = service(() => {
      throw new Error('jwt expired');
    });
    expect(connect(svc, fakeSocket('bad'))).toBe('Invalid token');
  });

  it('accepts a valid token and stores the user on socket.data', () => {
    const socket = fakeSocket('good');
    expect(connect(service(), socket)).toBeNull();
    expect(socket.data.user).toEqual({
      userId: 'u1',
      username: 'ada',
      email: 'a@x.io',
      role: 'admin',
    });
  });

  it('caps open sockets per user per namespace and frees a slot on disconnect', () => {
    const svc = service();
    const open = Array.from({ length: MAX_SOCKETS_PER_USER }, () =>
      fakeSocket('good'),
    );
    open.forEach((s) => expect(connect(svc, s)).toBeNull());

    expect(connect(svc, fakeSocket('good'))).toBe('Too many open connections');
    // Another namespace has its own count.
    expect(connect(svc, fakeSocket('good', '/leaderboard'))).toBeNull();

    open[0].emit('disconnect');
    expect(connect(svc, fakeSocket('good'))).toBeNull();
  });
});
