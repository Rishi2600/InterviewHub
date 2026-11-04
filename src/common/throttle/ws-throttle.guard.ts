import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthUser } from '../decorators/current-user.decorator';

const DROP_WHEN_THROTTLED = 'ws-throttle:drop';

/** Over the limit, drop the event quietly instead of sending an error. */
export const DropWhenThrottled = () => SetMetadata(DROP_WHEN_THROTTLED, true);

/** Thrown for dropped events; WsExceptionsFilter sends nothing for it. */
export class DroppedEventException extends WsException {
  constructor() {
    super('Dropped');
  }
}

/**
 * Per-event rate limit for sockets, counted per user so opening more sockets
 * does not raise it. Runs after WsJwtGuard, which sets client.data.user.
 */
@Injectable()
export class WsThrottleGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(context.getType() !== 'ws');
  }

  protected getRequestResponse(context: ExecutionContext) {
    const client = context.switchToWs().getClient<Socket>();
    return { req: client, res: client };
  }

  protected getTracker(client: Socket): Promise<string> {
    const user = (client.data as { user?: AuthUser }).user;
    return Promise.resolve(user?.userId ?? client.id);
  }

  // Sockets have no response headers.
  protected setResponseHeader(): void {}

  protected throwThrottlingException(context: ExecutionContext): Promise<void> {
    const drop = this.reflector.get<boolean>(
      DROP_WHEN_THROTTLED,
      context.getHandler(),
    );
    throw drop ? new DroppedEventException() : new WsException('Slow down');
  }
}
