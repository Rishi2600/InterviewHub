import { Types } from 'mongoose';
import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';

interface Check {
  label: string;
  ok: boolean;
}
interface Editor {
  contest: { status: string; questionCount: number; endAt: string };
  checks: Check[];
  usage: { used: number; limit: number } | null;
}

const inAnHour = () => new Date(Date.now() + 60 * 60_000).toISOString();

const question = (over: object = {}) => ({
  kind: 'single',
  prompt: 'What does useState return?',
  options: [
    { id: 'a', text: 'A value and a setter' },
    { id: 'b', text: 'A ref' },
  ],
  correctOptionIds: ['a'],
  ...over,
});

describe('hosting contests (e2e)', () => {
  let t: TestApp;
  let other: TestUser;
  beforeAll(async () => {
    t = await startApp();
    other = await signUp(t, 'other');
  });
  afterAll(() => t.app.close());

  const as = (user: TestUser) => ({
    create: (title = 'React Hooks') =>
      t.api().post('/contests').set(bearer(user)).send({ title }),
    editor: (id: string) =>
      t.api().get(`/contests/${id}/editor`).set(bearer(user)),
    patch: (id: string, body: object) =>
      t.api().patch(`/contests/${id}`).set(bearer(user)).send(body),
    questions: (id: string, questions: object[]) =>
      t
        .api()
        .put(`/contests/${id}/questions`)
        .set(bearer(user))
        .send({ questions }),
    publish: (id: string) =>
      t.api().post(`/contests/${id}/publish`).set(bearer(user)),
    cancel: (id: string) =>
      t.api().post(`/contests/${id}/cancel`).set(bearer(user)),
    remove: (id: string) => t.api().delete(`/contests/${id}`).set(bearer(user)),
    join: (id: string) =>
      t.api().post(`/contests/${id}/join`).set(bearer(user)),
  });

  /** A draft that passes every publish check. */
  async function readyDraft(host: TestUser): Promise<string> {
    const api = as(host);
    const { _id } = data<{ _id: string }>(await api.create().expect(201));
    await api
      .patch(_id, {
        description: 'Questions on hooks.',
        startAt: inAnHour(),
        durationMinutes: 45,
      })
      .expect(200);
    await api.questions(_id, [question()]).expect(200);
    return _id;
  }

  const startNow = (id: string) =>
    t.db
      .collection('contests')
      .updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { startAt: new Date(Date.now() - 60_000) } },
      );

  it('walks a draft from failing checks to published', async () => {
    const host = await signUp(t, 'walker', 'interviewer');
    const api = as(host);
    const { _id } = data<{ _id: string }>(await api.create().expect(201));

    const before = data<Editor>(await api.editor(_id).expect(200));
    expect(before.checks.filter((c) => !c.ok).map((c) => c.label)).toEqual([
      'Description',
      'Starts at least 15 minutes from now',
      'Length between 10 minutes and 24 hours',
      '1 to 50 questions',
    ]);
    expect(before.usage).toMatchObject({ used: 0, limit: 2 });

    const res = await api.publish(_id).expect(400);
    expect(res.body.message).toContain('Description');

    await api
      .patch(_id, {
        description: 'Questions on hooks.',
        startAt: inAnHour(),
        durationMinutes: 45,
      })
      .expect(200);
    await api
      .questions(_id, [question(), question({ kind: 'multiple' })])
      .expect(200);
    const after = data<Editor>(await api.editor(_id).expect(200));
    expect(after.checks.every((c) => c.ok)).toBe(true);
    expect(after.contest.questionCount).toBe(2);

    const published = data<{ status: string; endAt: string }>(
      await api.publish(_id).expect(201),
    );
    expect(published.status).toBe('published');
    const usage = data<Editor>(await api.editor(_id).expect(200)).usage;
    expect(usage?.used).toBe(1);
  });

  it('shows the editor and its actions to the host only', async () => {
    const host = await signUp(t, 'owner', 'interviewer');
    const id = await readyDraft(host);
    const api = as(other);
    await api.editor(id).expect(404);
    await api.patch(id, { title: 'Mine now' }).expect(404);
    await api.questions(id, []).expect(404);
    await api.publish(id).expect(404);
    await api.cancel(id).expect(404);
    await api.remove(id).expect(404);
  });

  it('holds the free limit, and an early cancel gives the slot back', async () => {
    const host = await signUp(t, 'busy', 'interviewer');
    const api = as(host);
    const [a, b, c] = [
      await readyDraft(host),
      await readyDraft(host),
      await readyDraft(host),
    ];
    await api.publish(a).expect(201);
    await api.publish(b).expect(201);
    await api.publish(c).expect(403);

    await api.cancel(a).expect(201);
    await api.publish(c).expect(201);

    // Someone joined b, so cancelling it keeps the slot used.
    await as(other).join(b).expect(201);
    await api.cancel(b).expect(201);
    const d = await readyDraft(host);
    await api.publish(d).expect(403);
  });

  it('locks a contest once it starts', async () => {
    const host = await signUp(t, 'locker', 'interviewer');
    const api = as(host);
    const id = await readyDraft(host);
    await api.publish(id).expect(201);
    await startNow(id);
    await api.patch(id, { title: 'Too late' }).expect(409);
    await api.questions(id, [question()]).expect(409);
    await api.cancel(id).expect(409);
  });

  it('keeps a published contest publishable after every edit', async () => {
    const host = await signUp(t, 'editor', 'interviewer');
    const api = as(host);
    const id = await readyDraft(host);
    await api.publish(id).expect(201);
    const soon = new Date(Date.now() + 5 * 60_000).toISOString();
    await api.patch(id, { startAt: soon }).expect(400);
    await api.questions(id, []).expect(400);
    await api.patch(id, { title: 'Renamed' }).expect(200);
  });

  it('deletes a draft but not a published contest', async () => {
    const host = await signUp(t, 'tidy', 'interviewer');
    const api = as(host);
    const draft = await readyDraft(host);
    await api.remove(draft).expect(204);
    await t.api().get(`/contests/${draft}`).set(bearer(host)).expect(404);

    const live = await readyDraft(host);
    await api.publish(live).expect(201);
    await api.remove(live).expect(409);
  });

  it('stops the host entering their own contest', async () => {
    const host = await signUp(t, 'self', 'interviewer');
    const id = await readyDraft(host);
    await as(host).publish(id).expect(201);
    await as(host).join(id).expect(403);
    await as(other).join(id).expect(201);
    await as(other).join(id).expect(201);
    const view = data<Editor>(await as(host).editor(id).expect(200));
    expect(view.contest).toMatchObject({ status: 'published' });
    const contest = await t.db
      .collection('contests')
      .findOne({ _id: new Types.ObjectId(id) });
    expect(contest?.entrantCount).toBe(1);
  });

  it('takes a full question list up to 512 KB on that route only', async () => {
    const host = await signUp(t, 'bulk', 'interviewer');
    const api = as(host);
    const { _id } = data<{ _id: string }>(await api.create().expect(201));
    const biggest = Array.from({ length: 50 }, () =>
      question({
        prompt: 'p'.repeat(2000),
        explanation: 'e'.repeat(2000),
        options: 'abcdef'
          .split('')
          .map((id) => ({ id, text: 'o'.repeat(300) })),
      }),
    );
    await api.questions(_id, biggest).expect(200);

    const tooBig = Array.from({ length: 50 }, () =>
      question({ prompt: 'p'.repeat(11_000) }),
    );
    await api.questions(_id, tooBig).expect(413);
    await api.patch(_id, { description: 'd'.repeat(150_000) }).expect(413);
  });
});
