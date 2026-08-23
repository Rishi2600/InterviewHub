import { Types } from 'mongoose';
import { WsException } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ChatGateway } from './chat.gateway';
import { RoomsService } from '../rooms/rooms.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

const OWNER_ID = new Types.ObjectId().toString();
const ROOM_ID = new Types.ObjectId().toString();

const owner: AuthUser = {
  userId: OWNER_ID,
  username: 'ada',
  email: 'ada@example.com',
  role: 'interviewer',
};
const participant: AuthUser = {
  userId: new Types.ObjectId().toString(),
  username: 'bob',
  email: 'bob@example.com',
  role: 'candidate',
};
const admin: AuthUser = {
  userId: new Types.ObjectId().toString(),
  username: 'root',
  email: 'root@example.com',
  role: 'admin',
};

function buildGateway() {
  const room = { ownerId: new Types.ObjectId(OWNER_ID), pinnedQuestion: null };
  const model = { findById: () => ({ exec: () => Promise.resolve(room) }) };

  // Real RoomsService so the gateway exercises the actual ownership rule.
  const roomsService = new RoomsService(model as never);
  const pinQuestion = jest
    .spyOn(roomsService, 'pinQuestion')
    .mockResolvedValue({ pinnedQuestion: 'Q1' } as never);
  const unpinQuestion = jest
    .spyOn(roomsService, 'unpinQuestion')
    .mockResolvedValue({} as never);

  const gateway = new ChatGateway({} as never, roomsService);
  const emit = jest.fn();
  gateway.server = { to: () => ({ emit }) } as unknown as Server;

  return { gateway, pinQuestion, unpinQuestion, emit };
}

describe('ChatGateway pin authorization', () => {
  it('lets the room owner pin a question', async () => {
    const { gateway, pinQuestion, emit } = buildGateway();
    await expect(
      gateway.onPin({ roomId: ROOM_ID, question: 'Q1' }, owner),
    ).resolves.toEqual({ ok: true });
    expect(pinQuestion).toHaveBeenCalledWith(ROOM_ID, 'Q1');
    expect(emit).toHaveBeenCalledWith('question:pinned', { question: 'Q1' });
  });

  it('lets an admin pin a question in a room they do not own', async () => {
    const { gateway, pinQuestion } = buildGateway();
    await expect(
      gateway.onPin({ roomId: ROOM_ID, question: 'Q1' }, admin),
    ).resolves.toEqual({ ok: true });
    expect(pinQuestion).toHaveBeenCalled();
  });

  it('rejects a non-owner participant and does not mutate the room', async () => {
    const { gateway, pinQuestion, emit } = buildGateway();
    await expect(
      gateway.onPin({ roomId: ROOM_ID, question: 'hijack' }, participant),
    ).rejects.toThrow(WsException);
    expect(pinQuestion).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('rejects a non-owner participant unpinning', async () => {
    const { gateway, unpinQuestion, emit } = buildGateway();
    await expect(
      gateway.onUnpin({ roomId: ROOM_ID }, participant),
    ).rejects.toThrow(WsException);
    expect(unpinQuestion).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('lets the room owner unpin', async () => {
    const { gateway, unpinQuestion, emit } = buildGateway();
    await expect(gateway.onUnpin({ roomId: ROOM_ID }, owner)).resolves.toEqual({
      ok: true,
    });
    expect(unpinQuestion).toHaveBeenCalledWith(ROOM_ID);
    expect(emit).toHaveBeenCalledWith('question:unpinned', {});
  });
});
