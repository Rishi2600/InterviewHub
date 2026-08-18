import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * Global WebSocket exception filter. Emits a consistent 'error' event to the
 * offending client instead of silently dropping the exception.
 */
@Catch()
export class WsExceptionsFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const message =
      exception instanceof WsException
        ? exception.getError()
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    client.emit('error', {
      event: 'error',
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
