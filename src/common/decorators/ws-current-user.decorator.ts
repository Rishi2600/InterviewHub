import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthUser } from './current-user.decorator';

/**
 * Extracts the authenticated user attached to a Socket by WsJwtGuard.
 * Usage: handler(@WsCurrentUser() user: AuthUser)
 */
export const WsCurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | any => {
    const client = ctx.switchToWs().getClient<Socket & { data: { user: AuthUser } }>();
    const user = client.data?.user;
    return data ? user?.[data] : user;
  },
);
