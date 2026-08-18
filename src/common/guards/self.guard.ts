import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Self-scope guard. Allows the action only when the :id route param matches
 * the authenticated user's id (i.e. users can only mutate their own resource).
 * Admins bypass the check.
 */
@Injectable()
export class SelfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthUser; params: { id: string } }>();
    const user = request.user;
    const targetId = request.params.id;

    if (user.role === 'admin') return true;

    if (user.userId !== targetId) {
      throw new ForbiddenException('You can only modify your own resource');
    }
    return true;
  }
}
