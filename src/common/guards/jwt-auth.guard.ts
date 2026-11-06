import {
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../decorators/current-user.decorator';

const OPTIONAL_AUTH = 'optionalAuth';

/**
 * Lets a route under JwtAuthGuard serve logged-out visitors too. A valid
 * token still sets the user; a missing or bad one leaves it null.
 */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH, true);

// Reflector only reads decorator metadata, so one shared instance is enough.
const reflector = new Reflector();

/**
 * HTTP authentication guard. Delegates to the 'jwt' passport strategy,
 * which validates the Bearer token and attaches the user to request.user.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthUser>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    const optional = reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (optional && (err || !user)) return null as TUser;
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user;
  }
}
