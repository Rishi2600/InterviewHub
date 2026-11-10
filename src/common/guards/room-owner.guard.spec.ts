import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { RoomOwnerGuard } from './room-owner.guard';
import { RoomsService } from '../../rooms/rooms.service';
import { RoomDocument } from '../../rooms/schemas/room.schema';

const OWNER_ID = new Types.ObjectId().toString();
const ROOM_ID = new Types.ObjectId().toString();

function contextFor(user: unknown, id: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params: { id } }) }),
  } as unknown as ExecutionContext;
}

/**
 * A real RoomsService over a stubbed model, so the guard exercises the actual
 * isOwnedBy rule rather than a re-implementation of it.
 */
function guardReturning(room: Partial<RoomDocument> | null): RoomOwnerGuard {
  const model = {
    findById: () => ({ exec: () => Promise.resolve(room) }),
  };
  return new RoomOwnerGuard(new RoomsService(model as never, {} as never));
}

describe('RoomOwnerGuard', () => {
  const room = { ownerId: new Types.ObjectId(OWNER_ID) } as RoomDocument;

  it('allows the room owner', async () => {
    const guard = guardReturning(room);
    const ctx = contextFor({ userId: OWNER_ID, role: 'interviewer' }, ROOM_ID);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows an admin who does not own the room', async () => {
    const guard = guardReturning(room);
    const ctx = contextFor(
      { userId: new Types.ObjectId().toString(), role: 'admin' },
      ROOM_ID,
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects a non-owner', async () => {
    const guard = guardReturning(room);
    const ctx = contextFor(
      { userId: new Types.ObjectId().toString(), role: 'interviewer' },
      ROOM_ID,
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the room does not exist', async () => {
    const guard = guardReturning(null);
    const ctx = contextFor({ userId: OWNER_ID, role: 'interviewer' }, ROOM_ID);
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });
});
