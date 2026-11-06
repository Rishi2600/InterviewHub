import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';

interface RoomPage {
  items: { _id: string; title: string }[];
  nextCursor: string | null;
  counts: Record<string, number>;
}

describe('paged lists (e2e)', () => {
  let t: TestApp;
  let host: TestUser;
  beforeAll(async () => {
    t = await startApp();
    host = await signUp(t, 'host', 'interviewer');
    for (let i = 1; i <= 25; i++) {
      await t
        .api()
        .post('/rooms')
        .set(bearer(host))
        .send({ title: `Room ${i}` })
        .expect(201);
    }
  });
  afterAll(() => t.app.close());

  const list = async (query = '') =>
    data<RoomPage>(
      await t.api().get(`/rooms${query}`).set(bearer(host)).expect(200),
    );

  it('pages newest first with a cursor, and the pages do not overlap', async () => {
    const first = await list();
    expect(first.items).toHaveLength(20);
    expect(first.items[0].title).toBe('Room 25');
    expect(first.counts).toEqual({ waiting: 25, active: 0, ended: 0 });

    const second = await list(`?cursor=${first.nextCursor}`);
    expect(second.items.map((r) => r.title)).toEqual([
      'Room 5',
      'Room 4',
      'Room 3',
      'Room 2',
      'Room 1',
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it('filters by state while totals stay for the whole list', async () => {
    const [newest] = (await list('?limit=1')).items;
    await t
      .api()
      .patch(`/rooms/${newest._id}/state`)
      .set(bearer(host))
      .send({ state: 'active' })
      .expect(200);

    const active = await list('?state=active');
    expect(active.items.map((r) => r._id)).toEqual([newest._id]);
    expect(active.counts).toEqual({ waiting: 24, active: 1, ended: 0 });
  });

  it('rejects a bad cursor, limit or state', async () => {
    for (const q of ['?cursor=abc', '?limit=51', '?state=gone']) {
      await t.api().get(`/rooms${q}`).set(bearer(host)).expect(400);
    }
  });
});
