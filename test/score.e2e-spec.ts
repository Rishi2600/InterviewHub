import { Types } from 'mongoose';
import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';
import { moveContest, publishContest, question } from './contest-helpers';
import { FinalizeService } from '../src/contests/finalize/finalize.service';
import { ScoreService } from '../src/score/score.service';

interface Score {
  user: { id: string; username: string; joinedAt: string };
  score: number | null;
  provisional: boolean;
  formula: { multiplier: number; submitted: number; window: number } | null;
  ratedCount: number;
  enteredCount: number;
  history: { score: number }[];
  badges: { id: string; count: number }[];
}
interface History {
  items: {
    title: string;
    rank: number;
    starters: number;
    rated: boolean;
    submitted: boolean;
    points: number;
    scoreAfter: number | null;
    change: number | null;
  }[];
  nextCursor: string | null;
  counts: { total: number };
}

// Q0 -> a (1 point), Q1 -> b (2 points), Q2 -> a (3 points).
const QUESTIONS = [
  question({ prompt: 'Q0', points: 1 }),
  question({ prompt: 'Q1', points: 2, correctOptionIds: ['b'] }),
  question({ prompt: 'Q2', points: 3 }),
];

describe('candidate score (e2e)', () => {
  let t: TestApp;
  let host: TestUser;
  let ann: TestUser;
  let bob: TestUser;
  let cat: TestUser;
  let contestId: string;

  const get = (user: TestUser, path: string) =>
    t.api().get(path).set(bearer(user));

  async function play(user: TestUser, picks: Record<string, string>) {
    const ws = data<{ questions: { _id: string; prompt: string }[] }>(
      await t
        .api()
        .post(`/contests/${contestId}/start`)
        .set(bearer(user))
        .expect(200),
    );
    for (const q of ws.questions) {
      if (!picks[q.prompt]) continue;
      await t
        .api()
        .put(`/contests/${contestId}/answers/${q._id}`)
        .set(bearer(user))
        .send({ optionIds: [picks[q.prompt]] })
        .expect(200);
    }
  }
  const submit = (user: TestUser) =>
    t.api().post(`/contests/${contestId}/submit`).set(bearer(user)).expect(200);

  beforeAll(async () => {
    t = await startApp();
    host = await signUp(t, 'host', 'interviewer');
    contestId = await publishContest(t, host, QUESTIONS);
    // Ten starters, so the contest is rated. ann gets everything right,
    // bob gets least and leaves it to the clock, the rest are in between.
    const others = await Promise.all(
      Array.from({ length: 8 }, (_, i) => signUp(t, `mid${i}`)),
    );
    [ann, bob] = await Promise.all([signUp(t, 'ann'), signUp(t, 'bob')]);
    cat = others[0];
    for (const u of [ann, bob, ...others])
      await t
        .api()
        .post(`/contests/${contestId}/join`)
        .set(bearer(u))
        .expect(201);
    await moveContest(t, contestId, -1);
    await play(ann, { Q0: 'a', Q1: 'b', Q2: 'a' });
    await submit(ann);
    for (const u of others) {
      await play(u, { Q1: 'b' });
      await submit(u);
    }
    await play(bob, { Q0: 'a' });
    await moveContest(t, contestId, -40, 30);
    const run = await t.app.get(FinalizeService).finalizeDue(new Date());
    expect(run.finalized).toContain(contestId);
  });
  afterAll(() => t.app.close());

  it('scores a rated contest as soon as it is finalized', async () => {
    const s = data<Score>(await get(ann, `/users/${ann.id}/score`).expect(200));
    // 1st of 10: p = 1, w = 10 / 50 = 0.2, submitted.
    // 10 × (0.2 + 1) / (0.2 + 2) = 5.4545
    expect(s.score).toBeCloseTo(12 / 2.2, 10);
    expect(s).toMatchObject({
      provisional: true,
      ratedCount: 1,
      enteredCount: 1,
    });
    expect(s.history).toHaveLength(1);
    expect(s.badges).toHaveLength(7);
    const earned = s.badges.filter((b) => b.count > 0).map((b) => b.id);
    expect(earned).toEqual(['first-rated', 'winner', 'podium', 'top-10']);
  });

  it('costs an unfinished contest 10% on top of its low rank', async () => {
    const s = data<Score>(await get(bob, `/users/${bob.id}/score`).expect(200));
    // Last of 10: p = 0, w = 0.2; none submitted: × 0.9.
    expect(s.score).toBeCloseTo((10 / 2.2) * 0.9, 10);
    expect(s.formula).toMatchObject({
      multiplier: 0.9,
      submitted: 0,
      window: 1,
    });
  });

  it('shows the score to the candidate, interviewers and admins only', async () => {
    await get(cat, `/users/${ann.id}/score`).expect(403);
    await get(cat, `/users/${ann.id}/activity`).expect(403);
    await get(cat, `/users/${ann.id}/contests`).expect(403);
    await t.api().get(`/users/${ann.id}/score`).expect(401);

    const seen = data<Score>(
      await get(host, `/users/${ann.id}/score`).expect(200),
    );
    expect(seen.user.username).toBe('ann');
    // Locked badges are the candidate's own business.
    expect(seen.badges.map((b) => b.id)).toEqual([
      'first-rated',
      'winner',
      'podium',
      'top-10',
    ]);
    await get(host, `/users/${new Types.ObjectId().toString()}/score`).expect(
      404,
    );
  });

  it('starts with no score and every badge locked', async () => {
    const dee = await signUp(t, 'dee');
    const s = data<Score>(await get(dee, `/users/${dee.id}/score`).expect(200));
    expect(s).toMatchObject({ score: null, ratedCount: 0, formula: null });
    expect(s.badges.every((b) => b.count === 0)).toBe(true);
  });

  it('lists contest history with the score after each', async () => {
    const h = data<History>(
      await get(host, `/users/${ann.id}/contests`).expect(200),
    );
    expect(h.counts.total).toBe(1);
    expect(h.nextCursor).toBeNull();
    expect(h.items[0]).toMatchObject({
      title: 'Quiz',
      rank: 1,
      starters: 10,
      rated: true,
      submitted: true,
      points: 6,
      change: null,
    });
    expect(h.items[0].scoreAfter).toBeCloseTo(12 / 2.2, 10);
  });

  it('counts activity per day for the graph', async () => {
    const a = data<{
      total: number;
      days: { count: number }[];
      years: number[];
    }>(await get(ann, `/users/${ann.id}/activity`).expect(200));
    expect(a.total).toBe(1);
    expect(a.days).toHaveLength(1);
    expect(a.years[0]).toBe(new Date().getUTCFullYear());
    await get(ann, `/users/${ann.id}/activity?year=1999`).expect(400);
  });

  it('gives the same score when recomputed again', async () => {
    const scores = t.app.get(ScoreService);
    const read = () =>
      t.db
        .collection('user_scores')
        .findOne(
          { userId: new Types.ObjectId(ann.id) },
          { projection: { _id: 0, createdAt: 0, updatedAt: 0 } },
        );
    const now = new Date();
    await scores.recomputeFor([new Types.ObjectId(ann.id)], now);
    const first = await read();
    await scores.recomputeFor([new Types.ObjectId(ann.id)], now);
    expect(await read()).toEqual(first);
    expect(first?.score).toBeCloseTo(12 / 2.2, 10);
  });
});
