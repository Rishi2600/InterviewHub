//@ts-nocheck

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

// SelfGuard — ensures a user can only modify their own resources
// Used on avatar upload endpoints so users can't overwrite each other's avatars
//
// How it knows which user is being targeted:
// The upload endpoints don't take a :userId param — they use the JWT itself
// @CurrentUser() in the controller already gives us the authenticated user
// So for upload routes, we just confirm the token belongs to a real user
// (JwtAuthGuard already does that) and that's sufficient
//
// For future routes like PUT /users/:id (edit profile), this guard would
// compare request.params.id against request.user._id to enforce self-only edits
@Injectable()
export class SelfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // set by JwtAuthGuard

    // If a :id param exists in the URL, enforce that it matches the token owner
    // e.g. PUT /users/:id — you can only edit your own profile
    const targetId = request.params.id;

    if (targetId) {
      const isSelf = targetId === user._id.toString();
      if (!isSelf) {
        throw new ForbiddenException(
          'You can only modify your own resources',
        );
      }
    }

    // For routes without a :id param (like /upload/avatar/disk)
    // JwtAuthGuard already confirmed the token is valid
    // SelfGuard here acts as a semantic marker — documents the intent
    // that this route is self-scoped, and handles future :id cases automatically
    return true;
  }
}