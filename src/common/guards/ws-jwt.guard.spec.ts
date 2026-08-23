import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { WsJwtGuard } from './ws-jwt.guard';

const PAYLOAD = {
  sub: 'u1',
  username: 'ada',
  email: 'ada@example.com',
  role: 'interviewer',
};

function socketWith(handshake: Record<string, unknown>): Socket {
  return { handshake, data: {} } as unknown as Socket;
}

function contextFor(client: Socket): ExecutionContext {
  return {
    switchToWs: () => ({ getClient: () => client }),
  } as unknown as ExecutionContext;
}

function guardVerifying(verify: () => unknown): WsJwtGuard {
  const jwt = { verify } as unknown as JwtService;
  const config = { get: () => 'test-secret' } as unknown as ConfigService;
  return new WsJwtGuard(jwt, config);
}

describe('WsJwtGuard', () => {
  it('rejects a handshake with no token at all', () => {
    const guard = guardVerifying(() => PAYLOAD);
    const client = socketWith({ auth: {}, headers: {}, query: {} });
    expect(() => guard.canActivate(contextFor(client))).toThrow(WsException);
  });

  it('rejects a handshake whose token does not verify', () => {
    const guard = guardVerifying(() => {
      throw new Error('invalid signature');
    });
    const client = socketWith({ auth: { token: 'bad' }, headers: {}, query: {} });
    expect(() => guard.canActivate(contextFor(client))).toThrow(WsException);
  });

  it('accepts auth.token and attaches the user to client.data', () => {
    const guard = guardVerifying(() => PAYLOAD);
    const client = socketWith({ auth: { token: 'good' }, headers: {}, query: {} });

    expect(guard.canActivate(contextFor(client))).toBe(true);
    expect(client.data.user).toEqual({
      userId: 'u1',
      username: 'ada',
      email: 'ada@example.com',
      role: 'interviewer',
    });
  });

  it('accepts a Bearer-prefixed token and the Authorization header', () => {
    const seen: string[] = [];
    const guard = guardVerifying(((token: string) => {
      seen.push(token);
      return PAYLOAD;
    }) as () => unknown);

    guard.canActivate(
      contextFor(
        socketWith({ auth: { token: 'Bearer abc' }, headers: {}, query: {} }),
      ),
    );
    guard.canActivate(
      contextFor(
        socketWith({ auth: {}, headers: { authorization: 'Bearer def' }, query: {} }),
      ),
    );

    // The Bearer prefix is stripped before verification in both cases.
    expect(seen).toEqual(['abc', 'def']);
  });
});
