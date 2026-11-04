import { Types } from 'mongoose';
import { WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
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

function buildGateway(roomOverrides: Record<string, unknown> = {}) {
  const room = {
    id: ROOM_ID,
    ownerId: new Types.ObjectId(OWNER_ID),
    state: 'active',
    participants: [{ userId: new Types.ObjectId(participant.userId) }],
    pinnedQuestion: null,
    ...roomOverrides,
  };
  const model = { findById: () => ({ exec: () => Promise.resolve(room) }) };

  // Real RoomsService so the gateway exercises the actual ownership rule.
  const roomsService = new RoomsService(model as never);
  const pinQuestion = jest
    .spyOn(roomsService, 'pinQuestion')
    .mockResolvedValue({ pinnedQuestion: 'Q1' } as never);
  const unpinQuestion = jest
    .spyOn(roomsService, 'unpinQuestion')
    .mockResolvedValue({} as never);

  const createMessage = jest.fn((m: Record<string, unknown>) =>
    Promise.resolve({ id: 'm1', ...m }),
  );
  const chatService = {
    history: jest.fn().mockResolvedValue([]),
    create: createMessage,
  };

  const gateway = new ChatGateway(chatService as never, roomsService);
  const emit = jest.fn();
  gateway.server = { to: () => ({ emit }) } as unknown as Server;

  return { gateway, pinQuestion, unpinQuestion, emit, createMessage };
}

/** A fake socket; `joined` lists the channels it is already in. */
function fakeSocket(joined: string[] = []) {
  const rooms = new Set(joined);
  const relay = jest.fn();
  const emit = jest.fn();
  return {
    rooms,
    relay,
    emit,
    socket: {
      rooms,
      join: jest.fn((c: string) => rooms.add(c)),
      leave: jest.fn((c: string) => rooms.delete(c)),
      emit,
      to: () => ({ emit: relay }),
    } as unknown as Socket,
  };
}

const stranger: AuthUser = {
  userId: new Types.ObjectId().toString(),
  username: 'eve',
  email: 'eve@example.com',
  role: 'candidate',
};
const CHANNEL = `room:${ROOM_ID}`;

describe('ChatGateway room membership', () => {
  it.each([
    ['owner', owner],
    ['participant', participant],
    ['admin', admin],
  ])('lets the %s join and receive history', async (_, user) => {
    const { gateway } = buildGateway();
    const { socket, rooms, emit } = fakeSocket();
    await expect(
      gateway.onJoin(socket, { roomId: ROOM_ID }, user),
    ).resolves.toMatchObject({ ok: true, roomId: ROOM_ID });
    expect(rooms.has(CHANNEL)).toBe(true);
    expect(emit).toHaveBeenCalledWith('chat:history', []);
  });

  it('rejects a non-member joining by room id, without leaking history', async () => {
    const { gateway, createMessage } = buildGateway();
    const { socket, rooms, emit } = fakeSocket();
    await expect(
      gateway.onJoin(socket, { roomId: ROOM_ID }, stranger),
    ).rejects.toThrow('You are not a participant in this room');
    expect(rooms.size).toBe(0);
    expect(emit).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('gives a missing room the same error as a forbidden one', async () => {
    const { gateway } = buildGateway();
    const { socket } = fakeSocket();
    await expect(
      gateway.onJoin(socket, { roomId: 'not-an-id' }, owner),
    ).rejects.toThrow('You are not a participant in this room');
  });

  it('lets members read an ended room without writing a join message', async () => {
    const { gateway, createMessage } = buildGateway({ state: 'ended' });
    const { socket, emit } = fakeSocket();
    await gateway.onJoin(socket, { roomId: ROOM_ID }, participant);
    expect(emit).toHaveBeenCalledWith('chat:history', []);
    expect(createMessage).not.toHaveBeenCalled();
  });
});

describe('ChatGateway sending', () => {
  it('lets a participant send a message', async () => {
    const { gateway, emit } = buildGateway();
    await expect(
      gateway.onMessage({ roomId: ROOM_ID, content: 'hi' }, participant),
    ).resolves.toEqual({ ok: true, id: 'm1' });
    expect(emit).toHaveBeenCalledWith(
      'chat:message',
      expect.objectContaining({ content: 'hi' }),
    );
  });

  it('rejects a non-member sending', async () => {
    const { gateway, createMessage, emit } = buildGateway();
    await expect(
      gateway.onMessage({ roomId: ROOM_ID, content: 'spam' }, stranger),
    ).rejects.toThrow(WsException);
    expect(createMessage).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('rejects sending to an ended room', async () => {
    const { gateway, createMessage } = buildGateway({ state: 'ended' });
    await expect(
      gateway.onMessage({ roomId: ROOM_ID, content: 'late' }, owner),
    ).rejects.toThrow('Room has ended');
    expect(createMessage).not.toHaveBeenCalled();
  });
});

describe('ChatGateway typing and leaving', () => {
  it('relays typing to others only for sockets that joined the room', () => {
    const { gateway } = buildGateway();
    const joined = fakeSocket([CHANNEL]);
    gateway.onTyping(joined.socket, { roomId: ROOM_ID }, participant);
    expect(joined.relay).toHaveBeenCalledWith('chat:typing', {
      userId: participant.userId,
      username: participant.username,
    });

    const outsider = fakeSocket();
    gateway.onTyping(outsider.socket, { roomId: ROOM_ID }, stranger);
    gateway.onStopTyping(outsider.socket, { roomId: ROOM_ID }, stranger);
    expect(outsider.relay).not.toHaveBeenCalled();
  });

  it('ignores room:leave from a socket that never joined', async () => {
    const { gateway, createMessage } = buildGateway();
    const { socket } = fakeSocket();
    await expect(
      gateway.onLeave(socket, { roomId: ROOM_ID }, stranger),
    ).resolves.toEqual({ ok: true });
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('announces a member leaving', async () => {
    const { gateway, createMessage, emit } = buildGateway();
    const { socket, rooms } = fakeSocket([CHANNEL]);
    await gateway.onLeave(socket, { roomId: ROOM_ID }, participant);
    expect(rooms.has(CHANNEL)).toBe(false);
    expect(createMessage).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('chat:system', expect.anything());
  });
});

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
