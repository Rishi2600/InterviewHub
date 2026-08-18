import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Attaches allowed roles to a route/handler. Read by RolesGuard.
 * Usage: @Roles(Role.Interviewer, Role.Admin)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
