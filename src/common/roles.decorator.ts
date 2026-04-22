import { SetMetadata } from '@nestjs/common';

// This is a custom metadata decorator
// When you write @Roles('interviewer') on a route,
// NestJS stores 'interviewer' as metadata on that route handler
// RolesGuard then reads this metadata and checks it against req.user.role
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);