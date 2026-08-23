import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SelfGuard } from './self.guard';

function contextFor(user: unknown, id: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params: { id } }) }),
  } as unknown as ExecutionContext;
}

describe('SelfGuard', () => {
  const guard = new SelfGuard();

  it('allows a user acting on their own id', () => {
    const user = { userId: 'u1', role: 'candidate' };
    expect(guard.canActivate(contextFor(user, 'u1'))).toBe(true);
  });

  it('rejects a user acting on someone else id', () => {
    const user = { userId: 'u1', role: 'candidate' };
    expect(() => guard.canActivate(contextFor(user, 'u2'))).toThrow(
      ForbiddenException,
    );
  });

  it('lets an admin act on any id', () => {
    const user = { userId: 'admin-1', role: 'admin' };
    expect(guard.canActivate(contextFor(user, 'u2'))).toBe(true);
  });
});
