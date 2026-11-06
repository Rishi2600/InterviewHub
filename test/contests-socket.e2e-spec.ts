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
import { moveContest, publishContest } from './contest-helpers';
import { FinalizeService } from '../src/contests/finalize/finalize.service';

interface Counts {
  contestId: string;
  entrantCount: number;
  startedCount: number;
  submittedCount: number;
}

describe('contest sockets (e2e)', () => {
  let t: TestApp;
  let host: TestUser;
  let fan: TestUser;
  const sockets: Socket[] = [];
  beforeAll(async () => {
    t = await startApp();
    host = await signUp(t, 'host', 'interviewer');
    fan = await signUp(t, 'fan');
  });
  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await t.app.close();
  });

  const open = async (user: TestUser) => {
    const socket = await connectSocket(t, '/contests', user);
    sockets.push(socket);
    return socket;
  };
  const watch = (socket: Socket, contestId: string) =>
    socket.emitWithAck('contest:watch', { contestId }) as Promise<{
      ok: boolean;
      counts: Counts;
    }>;

  it('lets any signed-in user watch a published contest, not a draft', async () => {
    const id = await publishContest(t, host);
    const socket = await open(fan);
    const ack = await watch(socket, id);
    expect(ack).toMatchObject({ ok: true, counts: { entrantCount: 0 } });

    const draft = data<{ _id: string }>(
      await t
        .api()
        .post('/contests')
        .set(bearer(host))
        .send({ title: 'Draft' })
        .expect(201),
    );
    const error = nextEvent<{ message: string }>(socket, 'error');
    socket.emit('contest:watch', { contestId: draft._id });
    expect((await error).message).toBe('Contest not found');
    const hostSocket = await open(host);
    expect((await watch(hostSocket, draft._id)).ok).toBe(true);
  });

  it('sends live counts as people join, start and submit', async () => {
    const id = await publishContest(t, host);
    const socket = await open(host);
    await watch(socket, id);

    const joined = nextEvent<Counts>(socket, 'contest:counts');
    await t.api().post(`/contests/${id}/join`).set(bearer(fan)).expect(201);
    expect(await joined).toMatchObject({ contestId: id, entrantCount: 1 });

    await moveContest(t, id, -1);
    const started = nextEvent<Counts>(socket, 'contest:counts');
    await t.api().post(`/contests/${id}/start`).set(bearer(fan)).expect(200);
    await t.api().post(`/contests/${id}/submit`).set(bearer(fan)).expect(200);
    // Both changes land within a second, so they arrive as one update.
    expect(await started).toMatchObject({
      entrantCount: 1,
      startedCount: 1,
      submittedCount: 1,
    });
  });

  it('sends the top of the board once results are out', async () => {
    const id = await publishContest(t, host);
    await t.api().post(`/contests/${id}/join`).set(bearer(fan)).expect(201);
    await moveContest(t, id, -1);
    await t.api().post(`/contests/${id}/start`).set(bearer(fan)).expect(200);
    await moveContest(t, id, -40, 30);

    const socket = await open(fan);
    await watch(socket, id);
    const done = nextEvent<{ contestId: string; top: { username: string }[] }>(
      socket,
      'contest:finalized',
    );
    await t.app.get(FinalizeService).finalizeDue(new Date());
    const event = await done;
    expect(event.contestId).toBe(id);
    expect(event.top.map((r) => r.username)).toEqual([fan.username]);
  });
});
