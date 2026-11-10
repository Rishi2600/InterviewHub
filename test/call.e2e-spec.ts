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

interface Peer {
  socketId: string;
  username: string;
  mic: boolean;
}

/** Resolves true if `event` arrives within `ms`, false otherwise. */
const arrives = (socket: Socket, event: string, ms = 300) =>
  new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    socket.once(event, () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

describe('calls over the room socket (e2e)', () => {
  let t: TestApp;
  let owner: TestUser;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await startApp();
    owner = await signUp(t, 'ivy', 'interviewer');
  });
  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await t.app.close();
  });

  async function newRoom(...members: TestUser[]) {
    const room = data<{ _id: string; code: string }>(
      await t
        .api()
        .post('/rooms')
        .set(bearer(owner))
        .send({ title: 'Call' })
        .expect(201),
    );
    for (const m of members) {
      await t.api().post(`/rooms/${room.code}/join`).set(bearer(m)).expect(201);
    }
    return room._id;
  }

  /** A socket in the room, and in its call. */
  async function inCall(user: TestUser, roomId: string) {
    const socket = await connectSocket(t, '/chat', user);
    sockets.push(socket);
    await socket.emitWithAck('room:join', { roomId });
    const ack = (await socket.emitWithAck('call:join', { roomId })) as {
      peers: Peer[];
    };
    return { socket, peers: ack.peers };
  }

  it('introduces newcomers and relays signals between people in the call', async () => {
    const sam = await signUp(t, 'sam');
    const roomId = await newRoom(sam);
    const ivy = await inCall(owner, roomId);
    const joined = nextEvent<Peer>(ivy.socket, 'call:peer-joined');
    const s = await inCall(sam, roomId);

    expect(s.peers).toEqual([
      expect.objectContaining({ socketId: ivy.socket.id, username: 'ivy' }),
    ]);
    expect(await joined).toMatchObject({
      socketId: s.socket.id,
      username: 'sam',
    });

    const signal = nextEvent<{ from: string; description: { type: string } }>(
      ivy.socket,
      'call:signal',
    );
    s.socket.emit('call:signal', {
      roomId,
      to: ivy.socket.id,
      description: { type: 'offer', sdp: 'v=0' },
    });
    expect(await signal).toMatchObject({
      from: s.socket.id,
      description: { type: 'offer', sdp: 'v=0' },
    });

    const state = nextEvent<{ socketId: string; mic: boolean }>(
      ivy.socket,
      'call:state',
    );
    s.socket.emit('call:state', {
      roomId,
      mic: false,
      cam: true,
      sharing: true,
    });
    expect(await state).toMatchObject({ socketId: s.socket.id, mic: false });

    const samId = s.socket.id;
    const left = nextEvent<{ socketId: string }>(ivy.socket, 'call:peer-left');
    s.socket.disconnect();
    expect(await left).toEqual({ socketId: samId });
  });

  it('never relays to a socket outside the call', async () => {
    const sam = await signUp(t, 'sam2');
    const roomId = await newRoom(sam);
    const ivy = await inCall(owner, roomId);
    // In the room, but not in the call.
    const watcher = await connectSocket(t, '/chat', sam);
    sockets.push(watcher);
    await watcher.emitWithAck('room:join', { roomId });

    const got = arrives(watcher, 'call:signal');
    ivy.socket.emit('call:signal', {
      roomId,
      to: watcher.id,
      description: { type: 'offer', sdp: 'v=0' },
    });
    expect(await got).toBe(false);
  });

  it('keeps non-members out of the call', async () => {
    const roomId = await newRoom();
    const outsider = await signUp(t, 'nosy');
    const socket = await connectSocket(t, '/chat', outsider);
    sockets.push(socket);
    const error = nextEvent<{ message: string }>(socket, 'error');
    socket.emit('call:join', { roomId });
    expect((await error).message).toMatch(/not a participant/);
  });

  it('holds at most 4 people', async () => {
    const people = await Promise.all(
      ['p1', 'p2', 'p3', 'p4'].map((n) => signUp(t, n)),
    );
    const roomId = await newRoom(...people);
    await inCall(owner, roomId);
    for (const p of people.slice(0, 3)) await inCall(p, roomId);

    const fifth = await connectSocket(t, '/chat', people[3]);
    sockets.push(fifth);
    await fifth.emitWithAck('room:join', { roomId });
    const error = nextEvent<{ message: string }>(fifth, 'error');
    fifth.emit('call:join', { roomId });
    expect((await error).message).toMatch(/full/);
  });

  it('gives each user one place: a second tab takes over', async () => {
    const sam = await signUp(t, 'tabby');
    const roomId = await newRoom(sam);
    await inCall(owner, roomId);
    const first = await inCall(sam, roomId);
    const replaced = nextEvent(first.socket, 'call:replaced');
    const second = await inCall(sam, roomId);
    await replaced;
    expect(second.peers.map((p) => p.username)).toEqual(['ivy']);
  });

  it('ends the call and tells the room when the room ends', async () => {
    const sam = await signUp(t, 'ender');
    const roomId = await newRoom(sam);
    const s = await inCall(sam, roomId);
    const ended = nextEvent<{ roomId: string }>(s.socket, 'room:ended');
    await t
      .api()
      .patch(`/rooms/${roomId}/state`)
      .set(bearer(owner))
      .send({ state: 'ended' })
      .expect(200);
    expect(await ended).toEqual({ roomId });

    const error = nextEvent<{ message: string }>(s.socket, 'error');
    s.socket.emit('call:join', { roomId });
    expect((await error).message).toMatch(/ended/);
  });

  it('hands TURN details to members only', async () => {
    const sam = await signUp(t, 'member');
    const roomId = await newRoom(sam);
    await t
      .api()
      .get(`/rooms/${roomId}/ice-servers`)
      .set(bearer(sam))
      .expect(200);
    const outsider = await signUp(t, 'outsider');
    await t
      .api()
      .get(`/rooms/${roomId}/ice-servers`)
      .set(bearer(outsider))
      .expect(404);
  });
});
