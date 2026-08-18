import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * WebSocket auth guard. Reads the JWT from the handshake (auth.token,
 * Authorization header, or ?token= query), verifies it, and stores the
 * decoded user on client.data.user for gateway handlers to read.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new WsException('Missing authentication token');
      }
      const payload = this.jwtService.verify<{
        sub: string;
        username: string;
        email: string;
        role: string;
      }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user: AuthUser = {
        userId: payload.sub,
        username: payload.username,
        email: payload.email,
        role: payload.role,
      };
      (client.data as { user: AuthUser }).user = user;
      return true;
    } catch (err) {
      this.logger.warn(`WS auth rejected: ${(err as Error).message}`);
      throw new WsException('Unauthorized');
    }
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
