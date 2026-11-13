import { Types } from 'mongoose';
import { utcDay } from '../src/ai/daily-budget';
import { FakeAi } from './fake-ai';
import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';

interface Item {
  questionId: string;
  prompt: string;
  options: { id: string; text: string }[];
  chosen?: string;
  correct?: boolean;
  correctOptionId?: string;
  explanation?: string;
  flagged?: boolean;
}
interface Drill {
  id: string;
  topic: string;
  status: 'active' | 'done';
  total: number;
  answered: number;
  right: number;
  items: Item[];
}

let batchNo = 0;
/** A batch of `n` sound questions; option index 0 is always the right one. */
function batch(n = 10) {
  batchNo += 1;
  return {
    text: JSON.stringify({
      questions: Array.from({ length: n }, (_, i) => ({
        prompt: `Batch ${batchNo} question ${i + 1}: what does SELECT do?`,
        code: '',
        options: ['Right answer', 'Wrong one', 'Also wrong', 'Not this'],
        correct: 0,
        explanation: 'Because the first option is the right answer here.',
      })),
    }),
  };
}

describe('Interview prep: drills', () => {
  let t: TestApp;
  const ai = new FakeAi();

  beforeAll(async () => {
    t = await startApp({ prepAi: ai });
  });
  afterAll(() => t.app.close());
  beforeEach(() => {
    ai.queue.length = 0;
    ai.requests.length = 0;
    ai.enabled = true;
  });

  const start = (u: TestUser, topic = 'SQL', level = 'junior') =>
    t.api().post('/prep/drills').set(bearer(u)).send({ topic, level });
  const answer = (
    u: TestUser,
    d: Drill,
    optionId: string,
    questionId?: string,
  ) =>
    t
      .api()
      .post(`/prep/drills/${d.id}/answers`)
      .set(bearer(u))
      .send({
        questionId: questionId ?? d.items[d.answered].questionId,
        optionId,
      });
  /** The id of the option whose text is "Right answer". */
  const rightId = (item: Item) =>
    item.options.find((o) => o.text === 'Right answer')!.id;
  const wrongId = (item: Item) =>
    item.options.find((o) => o.text !== 'Right answer')!.id;

  async function finish(u: TestUser, d: Drill, rightCount: number) {
    let cur = d;
    while (cur.status === 'active') {
      const item = cur.items[cur.answered];
      const pick = cur.answered < rightCount ? rightId(item) : wrongId(item);
      cur = data<Drill>(await answer(u, cur, pick).expect(200));
    }
    return cur;
  }

  it('is for candidates only', async () => {
    const host = await signUp(t, 'prep_host', 'interviewer');
    await t.api().get('/prep').set(bearer(host)).expect(403);
  });

  it('writes a batch into an empty shelf, then checks each answer at once', async () => {
    const u = await signUp(t, 'drill_amy');
    ai.queue.push(batch());
    const d = data<Drill>(await start(u).expect(201));
    expect(ai.requests).toHaveLength(1);
    expect(d.total).toBe(10);
    // Only the current question is sent, and without its answer.
    expect(d.items).toHaveLength(1);
    expect(d.items[0].correctOptionId).toBeUndefined();

    await answer(u, d, 'a', new Types.ObjectId().toString()).expect(409);
    const after = data<Drill>(
      await answer(u, d, rightId(d.items[0])).expect(200),
    );
    expect(after.items[0]).toMatchObject({ correct: true });
    expect(after.items[0].explanation).toContain('first option');
    expect(after.items).toHaveLength(2);

    // The same answer again counts once.
    const again = data<Drill>(
      await answer(u, d, rightId(d.items[0])).expect(409),
    );
    expect(again).toBeUndefined();
    const done = await finish(u, after, 7);
    expect(done).toMatchObject({ status: 'done', answered: 10, right: 7 });

    const event = await t.db
      .collection('activity_events')
      .findOne({ kind: 'prep', refId: new Types.ObjectId(d.id) });
    expect(event?.data).toMatchObject({
      mode: 'drill',
      topic: 'SQL',
      right: 7,
    });

    // Prep spends its own budget, not practice's.
    const day = utcDay(new Date());
    expect(
      await t.db.collection('prep_ai_budget').findOne({ day }),
    ).toMatchObject({
      usedRequests: 1,
    });
    expect(await t.db.collection('ai_budget').findOne({ day })).toBeNull();
  });

  it('serves the bank to the next candidate without asking the AI', async () => {
    const u = await signUp(t, 'drill_ben');
    const d = data<Drill>(await start(u).expect(201));
    expect(ai.requests).toHaveLength(0);
    expect(d.total).toBe(10);
  });

  it('writes more only once a candidate has seen the whole shelf', async () => {
    const u = await signUp(t, 'drill_cat');
    await finish(u, data<Drill>(await start(u).expect(201)), 10);
    expect(ai.requests).toHaveLength(0);

    ai.queue.push(batch());
    const second = data<Drill>(await start(u).expect(201));
    expect(ai.requests).toHaveLength(1);
    // The AI was told what's already on the shelf.
    expect(ai.requests[0].messages[0].content).toContain('Do not repeat');
    const first = await t.db.collection('prep_drills').findOne({
      userId: new Types.ObjectId(u.id),
      status: 'done',
    });
    const seen = new Set(
      first!.items.map((i: { questionId: Types.ObjectId }) =>
        i.questionId.toString(),
      ),
    );
    expect(seen.has(second.items[0].questionId)).toBe(false);
  });

  it('resumes a running drill on the same shelf instead of using a slot', async () => {
    const u = await signUp(t, 'drill_dan');
    const a = data<Drill>(await start(u).expect(201));
    const b = data<Drill>(await start(u).expect(201));
    expect(b.id).toBe(a.id);
    const usage = await t.db
      .collection('prep_usage')
      .findOne({ userId: new Types.ObjectId(u.id) });
    expect(usage?.drill).toBe(1);
  });

  it('turns away behavioural topics and a used-up day', async () => {
    const u = await signUp(t, 'drill_eve');
    await start(u, 'Teamwork').expect(400);
    await t.db.collection('prep_usage').insertOne({
      userId: new Types.ObjectId(u.id),
      day: utcDay(new Date()),
      drill: 10,
      coach: 0,
    });
    const res = await start(u).expect(403);
    expect((res.body as { error: string }).error).toBe('PrepDayUsed');
  });

  it('gives the slot back when the shelf is empty and the AI is off', async () => {
    const u = await signUp(t, 'drill_fay');
    ai.enabled = false;
    const res = await start(u, 'Python', 'senior').expect(503);
    expect((res.body as { error: string }).error).toBe('PrepNoQuestions');
    const usage = await t.db
      .collection('prep_usage')
      .findOne({ userId: new Types.ObjectId(u.id) });
    expect(usage?.drill).toBe(0);
  });

  it('hides a question two candidates flag as wrong', async () => {
    const [g, h] = [await signUp(t, 'drill_gus'), await signUp(t, 'drill_hal')];
    ai.queue.push(batch());
    const dg = data<Drill>(await start(g, 'React', 'mid').expect(201));
    const qid = dg.items[0].questionId;
    // Only after answering it.
    await t
      .api()
      .post(`/prep/drills/${dg.id}/questions/${qid}/flag`)
      .set(bearer(g))
      .expect(404);
    await answer(g, dg, rightId(dg.items[0])).expect(200);
    const flagged = data<Drill>(
      await t
        .api()
        .post(`/prep/drills/${dg.id}/questions/${qid}/flag`)
        .set(bearer(g))
        .expect(200),
    );
    expect(flagged.items[0].flagged).toBe(true);

    const question = () =>
      t.db
        .collection('prep_questions')
        .findOne({ _id: new Types.ObjectId(qid) });
    expect((await question())?.hidden).toBe(false);

    // The second candidate meets it too, in their own drill.
    await t.db.collection('prep_drills').insertOne({
      userId: new Types.ObjectId(h.id),
      topic: 'React',
      level: 'mid',
      items: [
        {
          questionId: new Types.ObjectId(qid),
          chosen: 'a',
          correct: false,
          flagged: false,
        },
      ],
      status: 'done',
      answered: 1,
      right: 0,
      startedAt: new Date(),
      lastAt: new Date(),
      endedAt: new Date(),
    });
    const hd = await t.db
      .collection('prep_drills')
      .findOne({ userId: new Types.ObjectId(h.id) });
    await t
      .api()
      .post(`/prep/drills/${hd!._id.toString()}/questions/${qid}/flag`)
      .set(bearer(h))
      .expect(200);
    expect((await question())?.hidden).toBe(true);
  });

  it("keeps each candidate's drills private", async () => {
    const [i, j] = [await signUp(t, 'drill_ivy'), await signUp(t, 'drill_jon')];
    const d = data<Drill>(await start(i).expect(201));
    await t.api().get(`/prep/drills/${d.id}`).set(bearer(j)).expect(404);
    await t.api().get(`/prep/drills/${d.id}`).set(bearer(i)).expect(200);
  });

  it('saves up to 3 focus topics from the shared list', async () => {
    const u = await signUp(t, 'drill_kim');
    const put = (topics: string[]) =>
      t.api().put('/prep/focus').set(bearer(u)).send({ topics });
    await put(['React', 'Teamwork']).expect(200);
    await put(['Cooking']).expect(400);
    await put(['React', 'SQL', 'Python', 'Teamwork']).expect(400);
    const overview = data<{
      focus: string[];
      today: { drill: { limit: number } };
    }>(await t.api().get('/prep').set(bearer(u)).expect(200));
    expect(overview.focus).toEqual(['React', 'Teamwork']);
    expect(overview.today.drill.limit).toBe(10);
  });

  it('suggests weak topics from practice feedback and drills, with the reason', async () => {
    const u = await signUp(t, 'drill_lou');
    const userId = new Types.ObjectId(u.id);
    const now = new Date();
    await t.db.collection('practice_interviews').insertOne({
      userId,
      purpose: 'interview',
      kind: 'technical',
      topic: 'SQL',
      mixed: false,
      level: 'junior',
      minutes: 30,
      language: null,
      mode: 'chat',
      status: 'done',
      startedAt: now,
      endsAt: now,
      endedAt: now,
      feedback: {
        summary: 'Shaky on joins.',
        areas: [
          { name: 'Knowledge', score: 3 },
          { name: 'Edge cases', score: 1 },
        ],
        strengths: [],
        improve: [],
        questions: [],
      },
    });
    await t
      .api()
      .put('/prep/focus')
      .set(bearer(u))
      .send({ topics: ['React'] });

    interface Topic {
      topic: string;
      strength: number | null;
      reason: { text: string } | null;
      focus: string | null;
      level: string;
    }
    const { recommended } = data<{
      recommended: { focus: Topic[]; suggestions: Topic[]; topics: Topic[] };
    }>(await t.api().get('/prep').set(bearer(u)).expect(200));
    expect(recommended.suggestions).toHaveLength(1);
    expect(recommended.suggestions[0]).toMatchObject({
      topic: 'SQL',
      focus: 'Edge cases',
      level: 'junior',
      reason: { text: '1/5 on Edge cases in your SQL practice interview' },
    });
    expect(recommended.focus).toEqual([
      expect.objectContaining({ topic: 'React', strength: null }),
    ]);
    expect(recommended.topics).toHaveLength(15);
  });

  it('counts an interviewer review towards weak spots', async () => {
    const host = await signUp(t, 'drill_host', 'interviewer');
    const u = await signUp(t, 'drill_max');
    const room = data<{ _id: string; code: string }>(
      await t
        .api()
        .post('/rooms')
        .set(bearer(host))
        .send({ title: 'SQL round' })
        .expect(201),
    );
    await t.api().post(`/rooms/${room.code}/join`).set(bearer(u)).expect(201);
    await t
      .api()
      .patch(`/rooms/${room._id}/state`)
      .set(bearer(host))
      .send({ state: 'ended' })
      .expect(200);
    await t
      .api()
      .put(`/reviews/rooms/${room._id}/${u.id}`)
      .set(bearer(host))
      .send({
        kind: 'technical',
        topics: ['SQL'],
        areas: [
          { name: 'Knowledge', score: 1 },
          { name: 'Edge cases', score: 2 },
        ],
      })
      .expect(200);
    const { recommended } = data<{
      recommended: {
        suggestions: { topic: string; reason: { text: string } }[];
      };
    }>(await t.api().get('/prep').set(bearer(u)).expect(200));
    expect(recommended.suggestions[0]).toMatchObject({
      topic: 'SQL',
      reason: { text: 'Interviewer review: 1/5 on Knowledge' },
    });
  });
});
