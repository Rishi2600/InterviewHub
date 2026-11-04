import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface AuthUser {
  userId: string;
  username: string;
  email: string;
  role: string;
}

/**
 * Extracts the authenticated user (set by JwtStrategy) from the HTTP request.
 * Usage: myRoute(@CurrentUser() user: AuthUser)
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthUser | undefined,
    ctx: ExecutionContext,
  ): AuthUser | AuthUser[keyof AuthUser] | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
