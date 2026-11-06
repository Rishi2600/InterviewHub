import { Socket } from 'socket.io-client';
import {
  bearer,
  connectSocket,
  data,
  nextEvent,
  signUp,
  startApp,
  TestApp,
} from './helpers';
import { publishContest } from './contest-helpers';

// Only meaningful with Redis on: `npm run test:e2e:redis`.
const withRedis =
  process.env.REDIS_ENABLED === 'true' ? describe : describe.skip;

/**
 * Two servers sharing one database and one Redis, as in production with
 * more than one instance. A broadcast caused by a request to one must reach
 * a socket connected to the other.
 */
withRedis('two servers with Redis (e2e)', () => {
  let a: TestApp;
  let b: TestApp;
  let socket: Socket;
  beforeAll(async () => {
    a = await startApp();
    b = await startApp({ keepData: true });
  });
  afterAll(async () => {
    socket?.disconnect();
    await Promise.all([a.app.close(), b.app.close()]);
  });

  it('reports Redis as up', async () => {
    const res = await a.api().get('/health/ready').expect(200);
    expect(data<{ checks: { redis: string } }>(res).checks.redis).toBe('up');
  });

  it('delivers live counts from one server to a socket on the other', async () => {
    const host = await signUp(a, 'host', 'interviewer');
    const fan = await signUp(a, 'fan');
    const id = await publishContest(a, host);

    socket = await connectSocket(a, '/contests', host);
    await socket.emitWithAck('contest:watch', { contestId: id });
    const counts = nextEvent<{ entrantCount: number }>(
      socket,
      'contest:counts',
    );
    await b.api().post(`/contests/${id}/join`).set(bearer(fan)).expect(201);
    expect((await counts).entrantCount).toBe(1);
  });
});
