import { Types } from 'mongoose';
import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';
import {
  contestDoc,
  moveContest,
  publishContest,
  question,
} from './contest-helpers';
import { FinalizeService } from '../src/contests/finalize/finalize.service';

interface Workspace {
  questions: { _id: string; prompt: string }[];
}
interface Row {
  username: string;
  rank: number;
  score: number;
  timeUsedMs: number;
  autoSubmitted: boolean;
}
interface Results {
  contest: { rated: boolean; starters: number };
  top: Row[];
  me: { rank: number; score: number } | null;
  questions: {
    prompt: string;
    correctOptionIds: string[];
    picked: string[] | null;
    earned: number;
    correctCount?: number;
  }[];
}

const MIN = 60_000;
// The key: Q0 -> a, Q1 -> b, Q2 -> a and c.
const QUESTIONS = [
  question({ prompt: 'Q0', points: 1 }),
  question({ prompt: 'Q1', points: 2, correctOptionIds: ['b'] }),
  question({
    prompt: 'Q2',
    kind: 'multiple',
    points: 3,
    correctOptionIds: ['a', 'c'],
  }),
];

describe('finalizing contests (e2e)', () => {
  let t: TestApp;
  let host: TestUser;
  let finalize: FinalizeService;
  beforeAll(async () => {
    t = await startApp();
    host = await signUp(t, 'host', 'interviewer');
    finalize = t.app.get(FinalizeService);
  });
  afterAll(() => t.app.close());

  const post = (user: TestUser, path: string) =>
    t.api().post(path).set(bearer(user));

  /** Starts the workspace and answers by prompt, e.g. { Q0: ['a'] }. */
  async function play(
    id: string,
    user: TestUser,
    picks: Record<string, string[]>,
    submit: boolean,
  ) {
    const ws = data<Workspace>(
      await post(user, `/contests/${id}/start`).expect(200),
    );
    for (const q of ws.questions) {
      if (!picks[q.prompt]) continue;
      await t
        .api()
        .put(`/contests/${id}/answers/${q._id}`)
        .set(bearer(user))
        .send({ optionIds: picks[q.prompt] })
        .expect(200);
    }
    if (submit) await post(user, `/contests/${id}/submit`).expect(200);
  }

  const results = (id: string, user: TestUser) =>
    t.api().get(`/contests/${id}/results`).set(bearer(user));

  it('runs a contest from publish to ranked results', async () => {
    const id = await publishContest(t, host, QUESTIONS);
    const [ann, bob, cat, dan] = await Promise.all(
      ['ann', 'bob', 'cat', 'dan'].map((n) => signUp(t, n)),
    );
    for (const u of [ann, bob, cat, dan]) {
      await post(u, `/contests/${id}/join`).expect(201);
    }
    await moveContest(t, id, -1);

    // ann: all right, submits first. cat: all right, submits second.
    // bob: Q0 and Q1 right, never submits. dan: never opens it.
    const all = { Q0: ['a'], Q1: ['b'], Q2: ['c', 'a'] };
    await play(id, ann, all, true);
    await play(id, bob, { Q0: ['a'], Q1: ['b'], Q2: ['a'] }, false);
    await play(id, cat, all, true);

    await moveContest(t, id, -40, 30);
    await results(id, ann).expect(409);
    const pending = data<{ phase: string }>(
      await t.api().get(`/contests/${id}`).set(bearer(ann)).expect(200),
    );
    expect(pending.phase).toBe('pending');

    const run = await finalize.finalizeDue(new Date());
    expect(run.finalized).toContain(id);

    const view = data<Results>(await results(id, ann).expect(200));
    expect(view.contest).toMatchObject({ rated: false, starters: 3 });
    expect(view.top.map((r) => [r.username, r.rank, r.score])).toEqual([
      ['ann', 1, 6],
      ['cat', 2, 6],
      ['bob', 3, 3],
    ]);
    const bobRow = view.top[2];
    expect(bobRow.autoSubmitted).toBe(true);
    expect(bobRow.timeUsedMs).toBe(30 * MIN);
    expect(view.me).toMatchObject({ rank: 1, score: 6 });
    expect(view.questions.map((q) => [q.prompt, q.earned])).toEqual([
      ['Q0', 1],
      ['Q1', 2],
      ['Q2', 3],
    ]);
    expect(view.questions[2].correctOptionIds).toEqual(['a', 'c']);
    expect(view.questions[0]).not.toHaveProperty('correctCount');

    // dan joined but never started: no rank, no result.
    const danView = data<Results>(await results(id, dan).expect(200));
    expect(danView.me).toBeNull();
    expect(danView.questions[0].picked).toBeNull();

    // The host sees how many got each question right.
    const hostView = data<Results>(await results(id, host).expect(200));
    expect(hostView.questions.map((q) => q.correctCount)).toEqual([3, 3, 2]);

    const doc = await contestDoc(t, id);
    expect(doc).toMatchObject({ startedCount: 3, submittedCount: 3 });
    const events = await t.db
      .collection('activity_events')
      .find({ refId: new Types.ObjectId(id) })
      .toArray();
    expect(events).toHaveLength(3);
    expect(
      events.find((e) => e.userId.toString() === bob.id)?.data,
    ).toMatchObject({ submitted: false, rank: 3, starters: 3 });
  });

  it('gives the same result when a finalize runs again', async () => {
    const id = await publishContest(t, host, QUESTIONS);
    const users = await Promise.all(['e1', 'e2'].map((n) => signUp(t, n)));
    for (const u of users) await post(u, `/contests/${id}/join`).expect(201);
    await moveContest(t, id, -1);
    await play(id, users[0], { Q0: ['a'] }, true);
    await play(id, users[1], { Q1: ['b'] }, false);
    await moveContest(t, id, -40, 30);

    await finalize.finalizeDue(new Date());
    const first = data<Results>(await results(id, host).expect(200));
    // Nothing left to claim.
    expect((await finalize.finalizeDue(new Date())).finalized).not.toContain(
      id,
    );

    // As if a lease ran out mid-way and another server ran it all again.
    await t.db
      .collection('contests')
      .updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { finalizedAt: null, lockedUntil: null } },
      );
    expect((await finalize.finalizeDue(new Date())).finalized).toContain(id);
    const second = data<Results>(await results(id, host).expect(200));
    expect(second.top).toEqual(first.top);
    expect(
      await t.db
        .collection('activity_events')
        .countDocuments({ refId: new Types.ObjectId(id) }),
    ).toBe(2);
  });

  it('lets only one claim hold a contest until its lease runs out', async () => {
    const id = await publishContest(t, host, QUESTIONS);
    await moveContest(t, id, -40, 30);
    const now = new Date();
    const claims = await Promise.all([
      finalize.claim(now),
      finalize.claim(now),
      finalize.claim(now),
    ]);
    const ours = claims.filter((c) => c?._id.toString() === id);
    expect(ours).toHaveLength(1);
    expect((await finalize.claim(now))?._id.toString()).not.toBe(id);
    // Six minutes on, the lease has run out and another server takes over.
    const later = new Date(now.getTime() + 6 * MIN);
    const run = await finalize.finalizeDue(later);
    expect(run.finalized).toContain(id);
  });

  it('never finalizes a cancelled contest, and rates one with 10 starters', async () => {
    const cancelled = await publishContest(t, host, QUESTIONS);
    await post(host, `/contests/${cancelled}/cancel`).expect(201);
    await moveContest(t, cancelled, -40, 30);

    const big = await publishContest(t, host, QUESTIONS);
    await moveContest(t, big, -40, 30);
    const doc = await contestDoc(t, big);
    await t.db.collection('contest_entries').insertMany(
      Array.from({ length: 10 }, (_, i) => ({
        contestId: new Types.ObjectId(big),
        userId: new Types.ObjectId(),
        username: `u${i}`,
        joinedAt: doc!.startAt,
        startedAt: doc!.startAt,
        submittedAt: new Date(doc!.startAt.getTime() + (i + 1) * MIN),
        autoSubmitted: false,
        answers: [],
      })),
    );

    const run = await finalize.finalizeDue(new Date());
    expect(run.finalized).toContain(big);
    expect(run.finalized).not.toContain(cancelled);
    expect((await contestDoc(t, cancelled))?.finalizedAt).toBeNull();
    expect((await contestDoc(t, big))?.rated).toBe(true);

    // The full board pages with a cursor.
    const page = (cursor = '') =>
      t
        .api()
        .get(
          `/contests/${big}/leaderboard?limit=4${cursor && `&cursor=${cursor}`}`,
        )
        .set(bearer(host))
        .expect(200);
    const seen: string[] = [];
    let cursor: string | null = '';
    while (cursor !== null) {
      const body = data<{ items: Row[]; nextCursor: string | null }>(
        await page(cursor),
      );
      seen.push(...body.items.map((r) => r.username));
      cursor = body.nextCursor;
    }
    expect(seen).toEqual(Array.from({ length: 10 }, (_, i) => `u${i}`));
  });
});
