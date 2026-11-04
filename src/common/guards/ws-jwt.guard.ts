import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthUser } from '../decorators/current-user.decorator';
import { SocketAuthService } from '../ws/socket-auth.service';

/**
 * Re-checks the handshake token on every event, so a token that expires while
 * the socket is open stops working. Stores the user on client.data.user.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly socketAuth: SocketAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    try {
      (client.data as { user: AuthUser }).user =
        this.socketAuth.authenticate(client);
      return true;
    } catch {
      throw new WsException('Unauthorized');
    }
  }
}
