import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardRequiring(required: Role[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: () => required,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any user when the route declares no roles', () => {
    const guard = guardRequiring(undefined);
    expect(guard.canActivate(contextFor({ role: 'candidate' }))).toBe(true);
  });

  it('allows any user when the roles list is empty', () => {
    const guard = guardRequiring([]);
    expect(guard.canActivate(contextFor({ role: 'candidate' }))).toBe(true);
  });

  it('allows a user whose role is in the list', () => {
    const guard = guardRequiring([Role.Interviewer, Role.Admin]);
    expect(guard.canActivate(contextFor({ role: 'interviewer' }))).toBe(true);
  });

  it('rejects a user whose role is not in the list', () => {
    const guard = guardRequiring([Role.Interviewer, Role.Admin]);
    expect(() => guard.canActivate(contextFor({ role: 'candidate' }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when no user is attached to the request', () => {
    const guard = guardRequiring([Role.Admin]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
