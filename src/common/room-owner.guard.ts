//@ts-check

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../rooms/schemas/room.schema';

// RoomOwnerGuard — runs AFTER JwtAuthGuard and RolesGuard
// By this point we already know:
//   1. The token is valid (JwtAuthGuard passed)
//   2. The user is an interviewer (RolesGuard passed)
// Now we check: did THIS interviewer create THIS room?
//
// Why a separate guard instead of doing this in the service?
// Guards are the right place for access control — they run before
// the controller and service, keeping authorization logic out of
// business logic. The service should never need to re-check ownership.
@Injectable()
export class RoomOwnerGuard implements CanActivate {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // req.user is attached by JwtAuthGuard — always present at this point
    const user = request.user;

    // The room ID comes from the URL param — e.g. PATCH /rooms/:id/state
    const roomId = request.params.id;

    if (!roomId) {
      throw new ForbiddenException('Room ID is required');
    }

    // Fetch the room from MongoDB to check ownership
    const room = await this.roomModel.findById(roomId).exec();

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // .toString() is critical here
    // room.createdBy is a MongoDB ObjectId object
    // user._id is also an ObjectId object
    // Comparing objects directly with !== always returns true even if values match
    // .toString() converts both to plain strings so the comparison works correctly
    const isOwner = room.createdBy.toString() === user._id.toString();

    if (!isOwner) {
      throw new ForbiddenException(
        'Only the room creator can perform this action',
      );
    }

    // Attach room to request so the controller/service doesn't need
    // to fetch it again — avoids a second redundant DB call
    request.room = room;

    return true;
  }
}