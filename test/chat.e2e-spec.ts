import { Socket } from 'socket.io-client';
import {
  bearer,
  connectSocket,
  data,
  nextEvent,
  signUp,
  startApp,
  TestApp,
  TestUser,
} from './helpers';

interface ChatMessage {
  content: string;
  type: string;
}

describe('chat over sockets (e2e)', () => {
  let t: TestApp;
  let host: TestUser;
  let guest: TestUser;
  let roomId: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await startApp();
    host = await signUp(t, 'host', 'interviewer');
    guest = await signUp(t, 'guest');
    const room = data<{ _id: string; code: string }>(
      await t
        .api()
        .post('/rooms')
        .set(bearer(host))
        .send({ title: 'Pairing' })
        .expect(201),
    );
    roomId = room._id;
    await t
      .api()
      .post(`/rooms/${room.code}/join`)
      .set(bearer(guest))
      .expect(201);
    await t
      .api()
      .patch(`/rooms/${roomId}/pin`)
      .set(bearer(host))
      .send({ question: 'Reverse a linked list' })
      .expect(200);
  });
  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await t.app.close();
  });

  const open = async (user: TestUser) => {
    const socket = await connectSocket(t, '/chat', user);
    sockets.push(socket);
    return socket;
  };

  it('returns the pinned question in the join ack, unwrapped', async () => {
    const socket = await open(guest);
    const ack = (await socket.emitWithAck('room:join', { roomId })) as {
      pinnedQuestion: string;
    };
    expect(ack.pinnedQuestion).toBe('Reverse a linked list');
  });

  it('delivers a message to the other member', async () => {
    const hostSocket = await open(host);
    await hostSocket.emitWithAck('room:join', { roomId });
    const guestSocket = await open(guest);
    await guestSocket.emitWithAck('room:join', { roomId });

    const received = nextEvent<ChatMessage>(hostSocket, 'chat:message');
    await guestSocket.emitWithAck('chat:send', { roomId, content: 'hello' });
    expect((await received).content).toBe('hello');
  });

  it('posts "joined the room" once per user however often they rejoin', async () => {
    for (let i = 0; i < 3; i++) {
      const socket = await open(guest);
      await socket.emitWithAck('room:join', { roomId });
      socket.disconnect();
    }
    const joined = await t.db.collection('messages').countDocuments({
      type: 'system',
      content: 'guest joined the room',
    });
    expect(joined).toBe(1);
  });

  it('refuses a socket from someone outside the room', async () => {
    const stranger = await signUp(t, 'stranger');
    const socket = await open(stranger);
    const error = nextEvent<{ message: string }>(socket, 'error');
    socket.emit('room:join', { roomId });
    expect((await error).message).toMatch(/not a participant/);
  });
});
