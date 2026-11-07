import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../decorators/current-user.decorator';
import { Role } from '../enums/role.enum';

/**
 * Who may see a candidate's score, badges, activity and contest history:
 * the candidate (the :id route param), interviewers and admins.
 */
@Injectable()
export class ScoreViewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user, params } = context
      .switchToHttp()
      .getRequest<Request & { user: AuthUser; params: { id: string } }>();
    if (user.userId === params.id) return true;
    if (
      user.role === String(Role.Interviewer) ||
      user.role === String(Role.Admin)
    )
      return true;
    throw new ForbiddenException(
      'Only the candidate, interviewers and admins can see this',
    );
  }
}
