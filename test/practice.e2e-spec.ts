import { Types } from 'mongoose';
import { Socket } from 'socket.io-client';
import { AiUnavailableError } from '../src/ai/ai.types';
import { PracticeService } from '../src/practice/practice.service';
import { END_LINE, POSE_LINE } from '../src/practice/prompts';
import { utcDay } from '../src/ai/daily-budget';
import { FakeAi } from './fake-ai';
import {
  bearer,
  connectSocket,
  data,
  nextEvent,
  PASSWORD,
  signUp,
  startApp,
  TestApp,
  TestUser,
} from './helpers';

interface TurnView {
  kind: 'ai' | 'candidate' | 'run';
  text: string;
}
interface View {
  id: string;
  status: string;
  endReason: string | null;
  answers: number;
  turns: TurnView[];
  codingQuestion: { title: string } | null;
  feedback: { areas: unknown[]; summary: string } | null;
  score: number | null;
}

describe('AI practice interviews', () => {
  let t: TestApp;
  const ai = new FakeAi();
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await startApp({ ai });
  });
  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await t.app.close();
  });
  beforeEach(() => {
    ai.queue.length = 0;
    ai.enabled = true;
  });

  const start = (u: TestUser, body: Record<string, unknown> = {}) =>
    t
      .api()
      .post('/practice')
      .set(bearer(u))
      .send({
        kind: 'technical',
        topic: 'Python',
        level: 'mid',
        minutes: 30,
        language: 'python',
        ...body,
      });
  const view = async (u: TestUser, id: string) =>
    data<View>(await t.api().get(`/practice/${id}`).set(bearer(u)).expect(200));
  const end = (u: TestUser, id: string) =>
    t.api().post(`/practice/${id}/end`).set(bearer(u)).expect(200);

  /** Starts an interview and opens it; resolves once the greeting is in. */
  async function begin(u: TestUser, body: Record<string, unknown> = {}) {
    const id = data<View>(await start(u, body).expect(201)).id;
    const s = await connectSocket(t, '/practice', u);
    sockets.push(s);
    const greeting = nextEvent<TurnView>(s, 'practice:turn');
    const ack = await s
      .timeout(5_000)
      .emitWithAck('practice:join', { interviewId: id });
    expect(ack).toMatchObject({ ok: true });
    await greeting;
    return { id, s };
  }
  const answer = (s: Socket, id: string, text: string, code?: string) =>
    s
      .timeout(5_000)
      .emitWithAck('practice:answer', { interviewId: id, text, code });

  async function waitFor<T>(read: () => Promise<T>, ok: (v: T) => boolean) {
    for (let i = 0; i < 50; i++) {
      const v = await read();
      if (ok(v)) return v;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('Timed out waiting');
  }

  it('is for candidates only, and private to the candidate', async () => {
    const ivy = await signUp(t, 'ivy', 'interviewer');
    await start(ivy).expect(403);
    const ann = await signUp(t, 'ann');
    const bob = await signUp(t, 'bob');
    const id = data<View>(await start(ann).expect(201)).id;
    await t.api().get(`/practice/${id}`).set(bearer(bob)).expect(404);
    await t.api().post(`/practice/${id}/end`).set(bearer(bob)).expect(404);
    await start(ann, { topic: 'Teamwork' }).expect(400);
    await end(ann, id);
  });

  it('streams the greeting and replies, and tells the AI the time left', async () => {
    const cid = await signUp(t, 'cid');
    ai.queue.push({ text: 'Hi Cid. What is a tuple?' });
    const { id, s } = await begin(cid);
    const drafts: string[] = [];
    s.on('practice:draft', (d: { text: string }) => drafts.push(d.text));

    ai.queue.push({ text: 'Why does that matter?' });
    const reply = nextEvent<TurnView>(s, 'practice:turn');
    expect(await answer(s, id, '  An immutable list.  ')).toEqual({ ok: true });
    expect(await reply).toMatchObject({
      kind: 'candidate',
      text: 'An immutable list.',
    });
    // The draft grows as the reply streams, each one the whole text so far.
    expect(drafts.at(-1)).toBe('Why does that matter?');
    expect(drafts.length).toBeGreaterThan(1);

    const sent = ai.last().messages;
    expect(sent[0].role).toBe('system');
    expect(sent.at(-2)?.content).toContain('An immutable list.');
    expect(sent.at(-1)).toEqual({
      role: 'system',
      content: 'Time left: 30 min. Answers left: 39.',
    });

    const iv = await view(cid, id);
    expect(iv.answers).toBe(1);
    expect(iv.turns.map((x) => x.kind)).toEqual(['ai', 'candidate', 'ai']);
    const overview = data<{
      running: { id: string };
      allowance: { used: number };
    }>(await t.api().get('/practice').set(bearer(cid)).expect(200));
    expect(overview.running.id).toBe(id);
    expect(overview.allowance.used).toBe(1);
    await end(cid, id);
  });

  it('takes one answer at a time, and gives back one the AI could not answer', async () => {
    const dee = await signUp(t, 'dee');
    const { id, s } = await begin(dee);

    let release: () => void = () => {};
    ai.queue.push(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ text: 'Go on.' });
        }),
    );
    const first = answer(s, id, 'First');
    await waitFor(
      () => view(dee, id),
      (v) => v.answers === 1,
    );
    const refused = nextEvent<{ message: string }>(s, 'error');
    s.emit('practice:answer', { interviewId: id, text: 'Second' });
    expect((await refused).message).toBe('Wait for the interviewer to finish');
    release();
    expect(await first).toEqual({ ok: true });

    ai.queue.push(new AiUnavailableError('busy'));
    const retracted = nextEvent<{ text: string }>(s, 'practice:retracted');
    const failed = (await answer(s, id, 'Lost answer')) as { ok: boolean };
    expect(failed.ok).toBe(false);
    expect((await retracted).text).toBe('Lost answer');
    const iv = await view(dee, id);
    expect(iv.answers).toBe(1);
    expect(iv.turns.some((x) => x.text === 'Lost answer')).toBe(false);
    await end(dee, id);
  });

  it('poses a coding question, records Runs and shows the AI the code', async () => {
    const eve = await signUp(t, 'eve');
    const { id, s } = await begin(eve);
    ai.queue.push({
      toolCalls: [
        {
          id: 'call_1',
          name: 'pose_coding_question',
          arguments: JSON.stringify({
            title: 'First unique character',
            statement: 'Print the position of the first unique character.',
            example_input: 'abca',
            example_output: '1',
          }),
        },
      ],
    });
    const posed = nextEvent<{ title: string }>(s, 'practice:question');
    await answer(s, id, 'Ready to code');
    expect((await posed).title).toBe('First unique character');
    expect(ai.last().tools?.map((x) => x.name)).toEqual([
      'pose_coding_question',
      'end_interview',
    ]);

    expect(
      await s.timeout(5_000).emitWithAck('practice:run', {
        interviewId: id,
        input: 'aabb',
        output: '0',
        status: 'ok',
        ms: 38,
      }),
    ).toEqual({ ok: true });
    await answer(s, id, 'Done', 'print(first_unique())');
    const sent = ai
      .last()
      .messages.map((m) => m.content)
      .join('\n');
    expect(sent).toContain(POSE_LINE);
    expect(sent).toContain('The candidate ran their code: finished in 38 ms');
    expect(sent).toContain('```python\nprint(first_unique())');

    // The same code again isn't sent twice.
    await answer(s, id, 'Still done', 'print(first_unique())');
    expect(ai.last().messages.at(-2)?.content).not.toContain('```python');
    const iv = await view(eve, id);
    expect(iv.codingQuestion?.title).toBe('First unique character');
    await end(eve, id);
  });

  it('ends, writes the feedback, adds a square and deletes the chat', async () => {
    const fay = await signUp(t, 'fay');
    const { id, s } = await begin(fay);
    await answer(s, id, 'Tuples are immutable.');
    const written = nextEvent<{ status: string }>(s, 'practice:feedback');
    const ended = data<View>(await end(fay, id));
    expect(ended.status).toBe('ended');
    expect((await written).status).toBe('done');

    const iv = await view(fay, id);
    expect(iv.status).toBe('done');
    expect(iv.turns).toEqual([]);
    expect(iv.feedback?.areas).toHaveLength(5);
    expect(iv.score).toBeGreaterThan(0);
    const feedbackReq = ai.last();
    expect(feedbackReq.json?.name).toBe('interview_feedback');
    expect(feedbackReq.messages[1].content).toContain(
      'Candidate: Tuples are immutable.',
    );

    const square = await t.db
      .collection('activity_events')
      .findOne({ kind: 'dummy', refId: new Types.ObjectId(id) });
    expect(square).not.toBeNull();
    // Practice never touches the candidate score.
    expect(
      await t.db
        .collection('user_scores')
        .findOne({ userId: new Types.ObjectId(fay.id) }),
    ).toBeNull();

    await t.api().delete(`/practice/${id}`).set(bearer(fay)).expect(204);
    await t.api().get(`/practice/${id}`).set(bearer(fay)).expect(404);
    expect(
      await t.db
        .collection('activity_events')
        .countDocuments({ refId: new Types.ObjectId(id) }),
    ).toBe(1);
  });

  it('never shows the candidate a bracketed remark, even while streaming', async () => {
    const max = await signUp(t, 'max');
    const { id, s } = await begin(max);
    const drafts: string[] = [];
    s.on('practice:draft', (d: { text: string }) => drafts.push(d.text));
    ai.queue.push({
      text: 'Good. [Pauses] What is a set? [Candidate: an unordered collection] Great!',
    });
    const reply = new Promise<TurnView>((resolve) =>
      s.on('practice:turn', (t: TurnView) => t.kind === 'ai' && resolve(t)),
    );
    await answer(s, id, 'Lists keep order.');
    expect((await reply).text).toBe('Good. What is a set?');
    expect(drafts.every((d) => !d.includes('['))).toBe(true);
    await end(max, id);
  });

  it('asks again when the AI ends far too early', async () => {
    const ned = await signUp(t, 'ned');
    const { id, s } = await begin(ned);
    ai.queue.push(
      { toolCalls: [{ id: 'e1', name: 'end_interview', arguments: '{}' }] },
      { text: 'Next: what is a generator?' },
    );
    const reply = new Promise<TurnView>((resolve) =>
      s.on('practice:turn', (t: TurnView) => t.kind === 'ai' && resolve(t)),
    );
    await answer(s, id, 'A tuple cannot change.');
    expect((await reply).text).toBe('Next: what is a generator?');
    expect(ai.last().messages.at(-1)?.content).toContain(
      "Don't end the interview yet",
    );
    expect((await view(ned, id)).status).toBe('active');
    await end(ned, id);
  });

  it('asks again when the AI poses the coding question straight away', async () => {
    const ola = await signUp(t, 'ola');
    const { id, s } = await begin(ola);
    const pose = {
      id: 'p1',
      name: 'pose_coding_question',
      arguments: JSON.stringify({
        title: 'Sum',
        statement: 'Add them.',
        example_input: '1 2',
        example_output: '3',
      }),
    };
    ai.queue.push(
      { toolCalls: [pose] },
      { text: 'First, what is a decorator?' },
    );
    const reply = new Promise<TurnView>((resolve) =>
      s.on('practice:turn', (t: TurnView) => t.kind === 'ai' && resolve(t)),
    );
    await answer(s, id, 'Mutable means it can change.');
    expect((await reply).text).toBe('First, what is a decorator?');
    expect((await view(ola, id)).codingQuestion).toBeNull();
    await end(ola, id);
  });

  it('lets the AI end the interview', async () => {
    const gus = await signUp(t, 'gus');
    const { id, s } = await begin(gus);
    ai.queue.push({
      toolCalls: [{ id: 'e1', name: 'end_interview', arguments: '{}' }],
    });
    const ended = nextEvent<{ reason: string }>(s, 'practice:ended');
    await answer(s, id, 'Please stop here.');
    expect((await ended).reason).toBe('ai');
    const iv = await waitFor(
      () => view(gus, id),
      (v) => v.status === 'done',
    );
    expect(iv.endReason).toBe('ai');
  });

  it('cancels an interview with no answers and gives the month back', async () => {
    const hal = await signUp(t, 'hal');
    const id = data<View>(await start(hal).expect(201)).id;
    expect(data<View>(await end(hal, id)).status).toBe('cancelled');
    const overview = data<{ allowance: { used: number }; items: unknown[] }>(
      await t.api().get('/practice').set(bearer(hal)).expect(200),
    );
    expect(overview.allowance.used).toBe(0);
    expect(overview.items).toEqual([]);
  });

  it('allows one at a time and three a month', async () => {
    const ida = await signUp(t, 'ida');
    for (let i = 0; i < 3; i++) {
      const { id, s } = await begin(ida, {
        kind: 'behavioural',
        topic: 'Mixed',
        language: undefined,
      });
      if (i === 0) {
        const again = await start(ida).expect(409);
        expect(again.body.error).toBe('PracticeRunning');
      }
      await answer(s, id, 'Once, at work...');
      await end(ida, id);
    }
    const refused = await start(ida).expect(403);
    expect(refused.body.error).toBe('PracticeMonthUsed');
  });

  it('refuses to start when the AI is off, busy or used up for today', async () => {
    const jo = await signUp(t, 'jo');
    ai.enabled = false;
    expect((await start(jo).expect(503)).body.error).toBe('PracticeOff');
    ai.enabled = true;

    const budget = t.db.collection('ai_budget');
    const day = utcDay(new Date());
    await budget.updateOne({ day }, { $set: { running: 0 } }, { upsert: true });
    const before = await budget.findOne({ day });

    await budget.updateOne({ day }, { $set: { running: 5 } });
    expect((await start(jo).expect(503)).body.error).toBe('PracticeBusy');
    await budget.updateOne(
      { day },
      { $set: { running: 0, reservedTokens: 290_000 } },
    );
    expect((await start(jo).expect(503)).body.error).toBe('PracticeDayFull');
    await budget.updateOne(
      { day },
      { $set: { reservedTokens: before?.reservedTokens ?? 0 } },
    );

    // Refused starts don't use up the month.
    const overview = data<{ allowance: { used: number } }>(
      await t.api().get('/practice').set(bearer(jo)).expect(200),
    );
    expect(overview.allowance.used).toBe(0);
  });

  it('ends overdue interviews, retries feedback, and gives up after a day', async () => {
    const kim = await signUp(t, 'kim');
    const service = t.app.get(PracticeService);
    const { id, s } = await begin(kim);
    await answer(s, id, 'An answer.');

    ai.queue.push(new AiUnavailableError('busy'));
    const later = new Date(Date.now() + 31 * 60_000);
    await service.sweep(later);
    const failedOnce = await waitFor(
      () =>
        t.db
          .collection('practice_interviews')
          .findOne({ _id: new Types.ObjectId(id) }),
      (d) => d?.feedbackTries === 1 && d.feedbackLeaseUntil > later,
    );
    expect(failedOnce?.status).toBe('ended');
    expect(failedOnce?.endReason).toBe('time');

    await service.sweep(new Date(later.getTime() + 2 * 60_000));
    expect((await view(kim, id)).status).toBe('done');

    // One that never gets feedback is given up after a day.
    const { id: id2, s: s2 } = await begin(kim);
    await answer(s2, id2, 'Another answer.');
    await t.db.collection('practice_interviews').updateOne(
      { _id: new Types.ObjectId(id2) },
      {
        $set: {
          status: 'ended',
          endedAt: new Date(),
          feedbackLeaseUntil: new Date(Date.now() + 3_600_000),
        },
        $unset: { running: 1 },
      },
    );
    await service.sweep(new Date(Date.now() + 25 * 60 * 60_000));
    const gaveUp = await view(kim, id2);
    expect(gaveUp.status).toBe('failed');
    expect(gaveUp.turns).toEqual([]);
  });

  it("shows admins today's AI use", async () => {
    const lee = await signUp(t, 'lee');
    await t.api().get('/practice/usage').set(bearer(lee)).expect(403);
    await t.db
      .collection('users')
      .updateOne(
        { _id: new Types.ObjectId(lee.id) },
        { $set: { role: 'admin' } },
      );
    const login = await t
      .api()
      .post('/auth/login')
      .send({ email: lee.email, password: PASSWORD })
      .expect(201);
    const token = data<{ accessToken: string }>(login).accessToken;
    const usage = data<{
      requests: { used: number; budget: number };
      running: number;
    }>(
      await t
        .api()
        .get('/practice/usage')
        .set({ Authorization: `Bearer ${token}` })
        .expect(200),
    );
    expect(usage.requests.used).toBeGreaterThan(0);
    expect(usage.requests.budget).toBe(1000);
  });

  it('keeps the end line for an AI that ends without words', () => {
    expect(END_LINE).toContain('feedback');
  });
});
