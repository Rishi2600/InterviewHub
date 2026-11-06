import { Types } from 'mongoose';
import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';
import {
  contestDoc,
  moveContest,
  publishContest,
  question,
} from './contest-helpers';

interface Workspace {
  questions: { _id: string; kind: string; options: { id: string }[] }[];
  answers: Record<string, string[]>;
  entry: { startedAt: string | null; submittedAt: string | null };
}

describe('entering contests (e2e)', () => {
  let t: TestApp;
  let host: TestUser;
  let ann: TestUser;
  beforeAll(async () => {
    t = await startApp();
    host = await signUp(t, 'host', 'interviewer');
    ann = await signUp(t, 'ann');
  });
  afterAll(() => t.app.close());

  const as = (user: TestUser) => ({
    join: (id: string) =>
      t.api().post(`/contests/${id}/join`).set(bearer(user)),
    leave: (id: string) =>
      t.api().post(`/contests/${id}/leave`).set(bearer(user)),
    start: (id: string) =>
      t.api().post(`/contests/${id}/start`).set(bearer(user)),
    answer: (id: string, qid: string, optionIds: string[]) =>
      t
        .api()
        .put(`/contests/${id}/answers/${qid}`)
        .set(bearer(user))
        .send({ optionIds }),
    submit: (id: string) =>
      t.api().post(`/contests/${id}/submit`).set(bearer(user)),
  });

  it('lets an entrant leave before the start only', async () => {
    const id = await publishContest(t, host);
    await as(ann).join(id).expect(201);
    expect((await contestDoc(t, id))?.entrantCount).toBe(1);
    await as(ann).leave(id).expect(204);
    expect((await contestDoc(t, id))?.entrantCount).toBe(0);
    await as(ann).leave(id).expect(404);

    await as(ann).join(id).expect(201);
    await moveContest(t, id, -1);
    await as(ann).leave(id).expect(409);
  });

  it('opens the workspace only while live, and only for entrants', async () => {
    const id = await publishContest(t, host);
    await as(ann).join(id).expect(201);
    await as(ann).start(id).expect(409);
    await moveContest(t, id, -1);
    const bob = await signUp(t, 'bob');
    await as(bob).start(id).expect(403);
    // Joining late is allowed; they just get the time that is left.
    await as(bob).join(id).expect(201);
    await as(bob).start(id).expect(200);
  });

  it('runs a full entry: start, autosave, reload, submit', async () => {
    const qs = Array.from({ length: 6 }, (_, i) =>
      question({ prompt: `Q${i}` }),
    );
    qs[5] = question({
      kind: 'multiple',
      prompt: 'Q5',
      correctOptionIds: ['a', 'b'],
    });
    const id = await publishContest(t, host, qs);
    const cara = await signUp(t, 'cara');
    await as(cara).join(id).expect(201);
    await moveContest(t, id, -1);

    const first = data<Workspace>(await as(cara).start(id).expect(200));
    const body = JSON.stringify(first);
    expect(body).not.toContain('correctOptionIds');
    expect(body).not.toContain('explanation');
    expect(first.entry.startedAt).not.toBeNull();
    const again = data<Workspace>(await as(cara).start(id).expect(200));
    expect(again.questions.map((q) => q._id)).toEqual(
      first.questions.map((q) => q._id),
    );
    expect((await contestDoc(t, id))?.startedCount).toBe(1);

    const single = first.questions.find((q) => q.kind === 'single')!;
    const multi = first.questions.find((q) => q.kind === 'multiple')!;
    await as(cara).answer(id, single._id, ['zz']).expect(400);
    await as(cara).answer(id, single._id, ['a', 'b']).expect(400);
    await as(cara).answer(id, 'nope', ['a']).expect(404);
    await as(cara).answer(id, single._id, ['b']).expect(200);
    await as(cara).answer(id, single._id, ['a']).expect(200);
    await as(cara).answer(id, multi._id, ['b', 'a']).expect(200);

    const reloaded = data<Workspace>(await as(cara).start(id).expect(200));
    expect(reloaded.answers[single._id]).toEqual(['a']);
    expect([...reloaded.answers[multi._id]].sort()).toEqual(['a', 'b']);

    await as(cara).answer(id, multi._id, []).expect(200);
    const cleared = data<Workspace>(await as(cara).start(id).expect(200));
    expect(cleared.answers).not.toHaveProperty(multi._id);

    await as(cara).submit(id).expect(200);
    await as(cara).submit(id).expect(409);
    await as(cara).answer(id, single._id, ['b']).expect(409);
    expect((await contestDoc(t, id))?.submittedCount).toBe(1);
  });

  it('refuses answers before the workspace opens and after the end', async () => {
    const id = await publishContest(t, host);
    const dan = await signUp(t, 'dan');
    await as(dan).join(id).expect(201);
    await moveContest(t, id, -1);
    const qid = (
      await t.db
        .collection('contest_questions')
        .findOne({ contestId: new Types.ObjectId(id) })
    )?._id.toString() as string;
    await as(dan).answer(id, qid, ['a']).expect(409);
    await as(dan).start(id).expect(200);
    await moveContest(t, id, -40, 30);
    await as(dan).answer(id, qid, ['a']).expect(409);
    await as(dan).submit(id).expect(409);
    await as(dan).start(id).expect(409);
  });

  it('gives entrants different question orders', async () => {
    const qs = Array.from({ length: 10 }, (_, i) =>
      question({ prompt: `Q${i}` }),
    );
    const id = await publishContest(t, host, qs);
    const users = [await signUp(t, 'e1'), await signUp(t, 'e2')];
    for (const u of users) await as(u).join(id).expect(201);
    await moveContest(t, id, -1);
    const orders = await Promise.all(
      users.map(async (u) =>
        data<Workspace>(await as(u).start(id).expect(200)).questions.map(
          (q) => q._id,
        ),
      ),
    );
    expect(orders[0]).not.toEqual(orders[1]);
    expect([...orders[0]].sort()).toEqual([...orders[1]].sort());
  });
});
