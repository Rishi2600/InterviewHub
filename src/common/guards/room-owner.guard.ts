import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { RoomsService } from '../../rooms/rooms.service';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Ownership guard. Runs AFTER JwtAuthGuard. Loads the room referenced by the
 * :id route param and allows the request only if the current user created it.
 * Admins bypass the check.
 */
@Injectable()
export class RoomOwnerGuard implements CanActivate {
  constructor(private readonly roomsService: RoomsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthUser; params: { id: string } }>();
    const user = request.user;
    const roomId = request.params.id;

    const room = await this.roomsService.findByIdRaw(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (user.role === 'admin') return true;

    if (room.ownerId.toString() !== user.userId) {
      throw new ForbiddenException('You do not own this room');
    }
    return true;
  }
}
