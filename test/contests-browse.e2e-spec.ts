import { Types } from 'mongoose';
import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';

interface Card {
  _id: string;
  title: string;
  phase: string;
  viewer?: { hosting: boolean; joined: boolean; rank: number | null };
}
interface BrowsePage {
  items: Card[];
  nextCursor: string | null;
  total: number;
}

const MIN = 60_000;

describe('browsing contests (e2e)', () => {
  let t: TestApp;
  let host: TestUser;
  let fan: TestUser;
  const ids: Record<string, Types.ObjectId> = {};

  /** A contest straight into the database, `start` minutes from now. */
  async function seed(
    key: string,
    start: number,
    length: number,
    over: object = {},
  ) {
    const now = Date.now();
    const { insertedId } = await t.db.collection('contests').insertOne({
      title: key,
      description: '',
      hostId: new Types.ObjectId(host.id),
      hostName: host.username,
      status: 'published',
      format: 'quiz',
      startAt: new Date(now + start * MIN),
      endAt: new Date(now + (start + length) * MIN),
      durationMinutes: length,
      questionCount: 5,
      totalPoints: 5,
      capacity: null,
      entrantCount: 0,
      startedCount: 0,
      submittedCount: 0,
      finalizedAt: null,
      rated: null,
      createdAt: new Date(now),
      ...over,
    });
    ids[key] = insertedId;
  }

  beforeAll(async () => {
    t = await startApp();
    host = await signUp(t, 'host', 'interviewer');
    fan = await signUp(t, 'fan');
    await seed('Live SQL', -10, 30);
    await seed('Live Regex (hard)', -5, 60);
    await seed('Upcoming React', 60, 30);
    await seed('Upcoming Rust', 120, 30);
    await seed('Upcoming Go', 180, 30);
    await seed('Past Trees', -120, 30, {
      finalizedAt: new Date(),
      rated: true,
    });
    await seed('Past Pending', -40, 30);
    await seed('Cancelled', 60, 30, { status: 'cancelled' });
    await seed('Draft', 60, 30, { status: 'draft' });

    await t.db.collection('contest_entries').insertMany(
      ['Upcoming React', 'Past Trees'].map((key) => ({
        contestId: ids[key],
        userId: new Types.ObjectId(fan.id),
        username: fan.username,
        joinedAt: new Date(),
        answers: [],
        rank: key === 'Past Trees' ? 4 : null,
      })),
    );
  });
  afterAll(() => t.app.close());

  const browse = async (query: string, user?: TestUser) => {
    const req = t.api().get(`/contests/browse?${query}`);
    if (user) void req.set(bearer(user));
    return data<BrowsePage>(await req.expect(200));
  };
  const titles = (page: BrowsePage) => page.items.map((c) => c.title);

  it('lists each tab without signing in, never drafts or cancelled ones', async () => {
    const live = await browse('phase=live');
    expect(titles(live)).toEqual(['Live SQL', 'Live Regex (hard)']);
    expect(live.items.every((c) => c.phase === 'live')).toBe(true);

    const upcoming = await browse('phase=upcoming');
    expect(titles(upcoming)).toEqual([
      'Upcoming React',
      'Upcoming Rust',
      'Upcoming Go',
    ]);
    expect(upcoming.total).toBe(3);
    expect(upcoming.items[0]).not.toHaveProperty('viewer');

    const past = await browse('phase=past');
    expect(past.items.map((c) => [c.title, c.phase])).toEqual([
      ['Past Pending', 'pending'],
      ['Past Trees', 'ended'],
    ]);
  });

  it('pages a tab with a cursor, in order and without repeats', async () => {
    const seen: string[] = [];
    let cursor: string | null = '';
    while (cursor !== null) {
      const page = await browse(
        `phase=upcoming&limit=1${cursor ? `&cursor=${cursor}` : ''}`,
      );
      expect(page.total).toBe(3);
      seen.push(...titles(page));
      cursor = page.nextCursor;
    }
    expect(seen).toEqual(['Upcoming React', 'Upcoming Rust', 'Upcoming Go']);
  });

  it('searches titles anywhere, ignoring case, with symbols taken literally', async () => {
    expect(titles(await browse('phase=upcoming&q=RUS'))).toEqual([
      'Upcoming Rust',
    ]);
    expect(titles(await browse('phase=live&q=(hard)'))).toEqual([
      'Live Regex (hard)',
    ]);
    expect(titles(await browse('phase=live&q=.*'))).toEqual([]);
  });

  it('marks hosting, joined and rank for a signed-in viewer', async () => {
    const forFan = await browse('phase=upcoming', fan);
    expect(forFan.items[0].viewer).toEqual({
      hosting: false,
      joined: true,
      rank: null,
    });
    expect(forFan.items[1].viewer?.joined).toBe(false);
    const past = await browse('phase=past', fan);
    expect(past.items[1].viewer?.rank).toBe(4);
    const forHost = await browse('phase=upcoming', host);
    expect(forHost.items[0].viewer?.hosting).toBe(true);
  });

  it('treats a bad token as signed out and rejects a bad query', async () => {
    const page = data<BrowsePage>(
      await t
        .api()
        .get('/contests/browse?phase=live')
        .set({ Authorization: 'Bearer not-a-token' })
        .expect(200),
    );
    expect(page.items[0]).not.toHaveProperty('viewer');
    await t.api().get('/contests/browse').expect(400);
    await t.api().get('/contests/browse?phase=all').expect(400);
    await t.api().get('/contests/browse?phase=live&cursor=junk').expect(400);
  });

  it('shows details to signed-in users only, with their entry', async () => {
    const id = ids['Past Trees'].toString();
    await t.api().get(`/contests/${id}`).expect(401);
    const view = data<{
      phase: string;
      viewer: { hosting: boolean; entry: { rank: number } | null };
      top: { username: string }[];
    }>(await t.api().get(`/contests/${id}`).set(bearer(fan)).expect(200));
    expect(view.phase).toBe('ended');
    expect(view.viewer.entry?.rank).toBe(4);
    expect(view.top.map((e) => e.username)).toEqual([fan.username]);
    await t
      .api()
      .get(`/contests/${ids.Draft.toString()}`)
      .set(bearer(fan))
      .expect(404);
  });

  it('never sends questions or answers with the details', async () => {
    const res = await t
      .api()
      .post('/contests')
      .set(bearer(host))
      .send({ title: 'Secret answers' })
      .expect(201);
    const id = data<{ _id: string }>(res)._id;
    await t
      .api()
      .put(`/contests/${id}/questions`)
      .set(bearer(host))
      .send({
        questions: [
          {
            kind: 'single',
            prompt: 'PROMPT-TEXT',
            options: [
              { id: 'a', text: 'OPTION-TEXT' },
              { id: 'b', text: 'Other' },
            ],
            correctOptionIds: ['a'],
          },
        ],
      })
      .expect(200);
    const body = JSON.stringify(
      (await t.api().get(`/contests/${id}`).set(bearer(host)).expect(200)).body,
    );
    for (const secret of ['PROMPT-TEXT', 'OPTION-TEXT', 'correctOptionIds']) {
      expect(body).not.toContain(secret);
    }
  });
});
