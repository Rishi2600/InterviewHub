import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RoomsService } from './rooms.service';
import { RoomDocument, RoomState } from './schemas/room.schema';

const ROOM_ID = new Types.ObjectId().toString();

interface StubRoom {
  state: RoomState;
  save: jest.Mock;
}

/** A RoomsService whose model returns one stub room document. */
function serviceWithRoom(state: RoomState): {
  service: RoomsService;
  room: StubRoom;
} {
  const room: StubRoom = {
    state,
    save: jest.fn(function (this: void) {
      return Promise.resolve(room);
    }),
  };
  const model = {
    findById: () => ({ exec: () => Promise.resolve(room) }),
  };
  return { service: new RoomsService(model as never), room };
}

describe('RoomsService state machine', () => {
  describe('allowed transitions', () => {
    it.each<[RoomState, RoomState]>([
      ['waiting', 'active'],
      ['waiting', 'ended'],
      ['active', 'ended'],
    ])('allows %s -> %s', async (from, to) => {
      const { service, room } = serviceWithRoom(from);
      await service.setState(ROOM_ID, to);
      expect(room.state).toBe(to);
      expect(room.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('rejected transitions', () => {
    it.each<[RoomState, RoomState]>([
      ['active', 'waiting'],
      ['ended', 'waiting'],
      ['ended', 'active'],
    ])('rejects %s -> %s', async (from, to) => {
      const { service, room } = serviceWithRoom(from);
      await expect(service.setState(ROOM_ID, to)).rejects.toThrow(
        BadRequestException,
      );
      expect(room.state).toBe(from);
      expect(room.save).not.toHaveBeenCalled();
    });
  });

  it('treats a no-op transition as a no-op and does not save', async () => {
    const { service, room } = serviceWithRoom('active');
    await service.setState(ROOM_ID, 'active');
    expect(room.state).toBe('active');
    expect(room.save).not.toHaveBeenCalled();
  });

  it('throws when the room does not exist', async () => {
    const model = { findById: () => ({ exec: () => Promise.resolve(null) }) };
    const service = new RoomsService(model as never);
    await expect(service.setState(ROOM_ID, 'active')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFound for a malformed room id rather than casting', async () => {
    const model = { findById: () => ({ exec: () => Promise.resolve(null) }) };
    const service = new RoomsService(model as never);
    await expect(
      service.setState('not-an-object-id', 'active'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('RoomsService.isOwnedBy', () => {
  const ownerId = new Types.ObjectId();
  const room = { ownerId } as RoomDocument;
  const service = new RoomsService({} as never);

  it('accepts the owner', () => {
    expect(
      service.isOwnedBy(room, {
        userId: ownerId.toString(),
        role: 'interviewer',
      }),
    ).toBe(true);
  });

  it('accepts any admin', () => {
    expect(
      service.isOwnedBy(room, {
        userId: new Types.ObjectId().toString(),
        role: 'admin',
      }),
    ).toBe(true);
  });

  it('rejects a non-owner', () => {
    expect(
      service.isOwnedBy(room, {
        userId: new Types.ObjectId().toString(),
        role: 'interviewer',
      }),
    ).toBe(false);
  });
});
