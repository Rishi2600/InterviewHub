import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  // Reflector is NestJS's tool for reading metadata set by decorators
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Read the roles metadata set by @Roles() on this specific route
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(), // check the method first
      context.getClass(),   // then the class
    ]);

    // If no @Roles() decorator is present, the route is accessible to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // At this point JwtAuthGuard has already run and attached user to req
    // RolesGuard always runs AFTER JwtAuthGuard in the guard chain
    const { user } = context.switchToHttp().getRequest();

    const hasRole = requiredRoles.includes(user?.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `This action requires one of these roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}