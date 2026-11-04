import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AuthUser } from '../decorators/current-user.decorator';
import { MAX_SOCKETS_PER_USER } from '../throttle/limits';

type SocketMiddleware = (socket: Socket, next: (err?: Error) => void) => void;

/**
 * Socket authentication, shared by the connect-time middleware and WsJwtGuard.
 * The token is read from auth.token, the Authorization header, or ?token=.
 */
@Injectable()
export class SocketAuthService {
  private readonly logger = new Logger(SocketAuthService.name);
  /** Open sockets per `${namespace}:${userId}`, on this instance. */
  private readonly openSockets = new Map<string, number>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Returns the token's user, or throws an Error with a client-safe message. */
  authenticate(client: Socket): AuthUser {
    const token = this.extractToken(client);
    if (!token) throw new Error('Missing authentication token');

    let payload: { sub: string; username: string; email: string; role: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch (err) {
      this.logger.warn(`WS auth rejected: ${(err as Error).message}`);
      throw new Error('Invalid token', { cause: err });
    }
    return {
      userId: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };
  }

  /**
   * Namespace middleware: refuses the connection unless the token verifies
   * and the user has fewer than MAX_SOCKETS_PER_USER sockets open here.
   */
  middleware(): SocketMiddleware {
    return (socket, next) => {
      let user: AuthUser;
      try {
        user = this.authenticate(socket);
      } catch (err) {
        return next(err as Error);
      }

      const key = `${socket.nsp.name}:${user.userId}`;
      const open = this.openSockets.get(key) ?? 0;
      if (open >= MAX_SOCKETS_PER_USER) {
        return next(new Error('Too many open connections'));
      }
      this.openSockets.set(key, open + 1);
      socket.once('disconnect', () => {
        const left = (this.openSockets.get(key) ?? 1) - 1;
        if (left > 0) this.openSockets.set(key, left);
        else this.openSockets.delete(key);
      });

      (socket.data as { user: AuthUser }).user = user;
      next();
    };
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake?.auth?.token as string | undefined;
    if (authToken) return authToken.replace(/^Bearer\s+/i, '');

    const header = client.handshake?.headers?.authorization;
    if (header) return header.replace(/^Bearer\s+/i, '');

    const queryToken = client.handshake?.query?.token;
    if (typeof queryToken === 'string') return queryToken;

    return undefined;
  }
}
