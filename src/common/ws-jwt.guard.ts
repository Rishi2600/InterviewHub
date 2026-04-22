import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient();

      // WebSocket connections don't use HTTP headers the same way
      // The token is passed during the Socket.io handshake like this:
      // socket = io('http://localhost:3000', { auth: { token: 'Bearer xxx' } })
      // We extract it from client.handshake.auth.token
      const rawToken: string =
        client.handshake?.auth?.token ||
        client.handshake?.headers?.authorization;

      if (!rawToken) {
        throw new UnauthorizedException('No token provided');
      }

      // Strip "Bearer " prefix if present
      const token = rawToken.replace('Bearer ', '').trim();

      // Verify and decode the token using the same secret
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      // Confirm user still exists in MongoDB
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Attach user to the socket client so gateways can access it
      // via @ConnectedSocket() client.data.user
      client.data.user = user;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}