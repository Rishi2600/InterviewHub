import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';
import { contestDoc, moveContest, question } from './contest-helpers';
import { FinalizeService } from '../src/contests/finalize/finalize.service';
import { CodeSubmission } from '../src/contests/schemas/code-submission.schema';
import { ContestQuestion } from '../src/contests/schemas/contest-question.schema';
import { claimNext, judgeJob } from '../src/judge/judge';
import { runProgram } from '../src/judge/sandbox/run';

const MIN = 60_000;

// Sum the numbers on stdin. 30 points over 3 hidden tests: 10 each.
const SUM = {
  kind: 'code',
  title: 'Sum',
  prompt: 'Print the sum of the numbers.',
  points: 30,
  timeLimitMs: 2_000,
  starterCode: { javascript: '// read stdin' },
  tests: [
    { input: '1 2', output: '3', visible: true },
    { input: '2 3', output: '5', visible: false },
    { input: '10 20 30', output: '60', visible: false },
    { input: '-1 1', output: '0', visible: false },
  ],
  hostAnswer: { language: 'python', code: 'HOST-SECRET-ANSWER' },
  explanation: 'Add them up.',
};
// A hidden input that appears nowhere else, for the leak checks.
const HIDDEN_INPUT = '10 20 30';

const READ =
  "require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number)";
const RIGHT = `const n = ${READ}\nconsole.log(n.reduce((a, b) => a + b, 0))`;
// Skips negative numbers, so the last hidden test fails: 2 of 3.
const PARTIAL = `const n = ${READ}.filter((x) => x > 0)\nconsole.log(n.reduce((a, b) => a + b, 0))`;
const WRONG = 'console.log(42)';

interface Workspace {
  contest: { format: string };
  questions: {
    _id: string;
    kind: string;
    title: string;
    examples: { input: string; output: string }[];
    hiddenCount: number;
    starterCode: Record<string, string>;
  }[];
  drafts: Record<string, { language: string; code: string }>;
  latest: Record<string, { status: string }>;
}
interface Submission {
  _id: string;
  status: string;
  verdicts: { verdict: string }[];
  passed: number;
  total: number;
  points: number;
}

describe('code contests (e2e)', () => {
  let t: TestApp;
  let host: TestUser;
  let finalize: FinalizeService;
  let models: {
    submissions: Model<CodeSubmission>;
    questions: Model<ContestQuestion>;
  };

  beforeAll(async () => {
    t = await startApp();
    host = await signUp(t, 'codehost', 'interviewer');
    finalize = t.app.get(FinalizeService);
    models = {
      submissions: t.app.get(getModelToken(CodeSubmission.name)),
      questions: t.app.get(getModelToken(ContestQuestion.name)),
    };
  });
  afterAll(() => t.app.close());

  const as = (user: TestUser) => ({
    get: (path: string) => t.api().get(path).set(bearer(user)),
    post: (path: string, body: object = {}) =>
      t.api().post(path).set(bearer(user)).send(body),
    put: (path: string, body: object) =>
      t.api().put(path).set(bearer(user)).send(body),
    patch: (path: string, body: object) =>
      t.api().patch(path).set(bearer(user)).send(body),
  });

  /** Judges everything queued, in this process, with the real sandbox. */
  async function judgeAll(): Promise<void> {
    for (;;) {
      const job = await claimNext(models.submissions, new Date());
      if (!job) return;
      await judgeJob(job, models, runProgram);
    }
  }

  async function codeContest(questions: object[] = [SUM]): Promise<string> {
    const api = as(host);
    const { _id } = data<{ _id: string }>(
      await api
        .post('/contests', { title: 'Sums', format: 'code' })
        .expect(201),
    );
    await api
      .patch(`/contests/${_id}`, {
        description: 'Add numbers.',
        startAt: new Date(Date.now() + 60 * MIN).toISOString(),
        durationMinutes: 30,
      })
      .expect(200);
    await api.put(`/contests/${_id}/questions`, { questions }).expect(200);
    await t.db
      .collection('host_usage')
      .deleteMany({ hostId: new Types.ObjectId(host.id) });
    await api.post(`/contests/${_id}/publish`).expect(201);
    return _id;
  }

  async function enter(id: string, name: string) {
    const user = await signUp(t, name);
    await as(user).post(`/contests/${id}/join`).expect(201);
    return user;
  }

  it('keeps the formats apart', async () => {
    const api = as(host);
    const { _id } = data<{ _id: string }>(
      await api
        .post('/contests', { title: 'Mixed', format: 'code' })
        .expect(201),
    );
    await api
      .put(`/contests/${_id}/questions`, { questions: [question()] })
      .expect(400);
    const quiz = data<{ _id: string }>(
      await api.post('/contests', { title: 'Quiz' }).expect(201),
    );
    await api
      .put(`/contests/${quiz._id}/questions`, { questions: [SUM] })
      .expect(400);
  });

  it('shows entrants the examples, never hidden tests or the host answer', async () => {
    const id = await codeContest();
    const sam = await enter(id, 'sam');
    await moveContest(t, id, -1);
    const res = await as(sam).post(`/contests/${id}/start`).expect(200);
    const ws = data<Workspace>(res);
    expect(ws.contest.format).toBe('code');
    expect(ws.questions[0]).toMatchObject({
      kind: 'code',
      title: 'Sum',
      examples: [{ input: '1 2', output: '3' }],
      hiddenCount: 3,
    });
    expect(ws.questions[0].starterCode.javascript).toBe('// read stdin');
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(HIDDEN_INPUT);
    expect(body).not.toContain('HOST-SECRET-ANSWER');
    expect(body).not.toContain('Add them up.');

    // The host's editor does get everything.
    const editor = JSON.stringify(
      (await as(host).get(`/contests/${id}/editor`).expect(200)).body,
    );
    expect(editor).toContain(HIDDEN_INPUT);
    expect(editor).toContain('HOST-SECRET-ANSWER');
  });

  it('saves drafts and brings them back with the workspace', async () => {
    const id = await codeContest();
    const sam = await enter(id, 'drafter');
    await moveContest(t, id, -1);
    const ws = data<Workspace>(
      await as(sam).post(`/contests/${id}/start`).expect(200),
    );
    const qid = ws.questions[0]._id;
    await as(sam)
      .put(`/contests/${id}/drafts/${qid}`, { language: 'python', code: 'x' })
      .expect(200);
    await as(sam)
      .put(`/contests/${id}/drafts/${qid}`, {
        language: 'javascript',
        code: 'y',
      })
      .expect(200);
    const again = data<Workspace>(
      await as(sam).post(`/contests/${id}/start`).expect(200),
    );
    expect(again.drafts[qid]).toMatchObject({
      language: 'javascript',
      code: 'y',
    });
  });

  it('judges a submission against the hidden tests only', async () => {
    const id = await codeContest();
    const sam = await enter(id, 'judged');
    await moveContest(t, id, -1);
    const ws = data<Workspace>(
      await as(sam).post(`/contests/${id}/start`).expect(200),
    );
    const qid = ws.questions[0]._id;
    const path = `/contests/${id}/questions/${qid}/submissions`;

    const queued = data<Submission>(
      await as(sam)
        .post(path, { language: 'javascript', code: PARTIAL })
        .expect(201),
    );
    expect(queued.status).toBe('queued');
    // One waiting submission at a time.
    await as(sam)
      .post(path, { language: 'javascript', code: RIGHT })
      .expect(409);

    await judgeAll();
    const [mine] = data<Submission[]>(await as(sam).get(path).expect(200));
    expect(mine).toMatchObject({
      status: 'done',
      passed: 2,
      total: 3,
      points: 20,
    });
    expect(mine.verdicts.map((v) => v.verdict)).toEqual([
      'passed',
      'passed',
      'wrong',
    ]);
    expect(JSON.stringify(mine)).not.toContain('code');
  });

  it('allows a limited number of submissions a minute', async () => {
    const id = await codeContest();
    const sam = await enter(id, 'eager');
    await moveContest(t, id, -1);
    const ws = data<Workspace>(
      await as(sam).post(`/contests/${id}/start`).expect(200),
    );
    const qid = ws.questions[0]._id;
    await t.db.collection('code_submissions').insertMany(
      Array.from({ length: 10 }, () => ({
        contestId: new Types.ObjectId(id),
        questionId: new Types.ObjectId(qid),
        userId: new Types.ObjectId(sam.id),
        language: 'javascript',
        code: WRONG,
        status: 'done',
        createdAt: new Date(),
      })),
    );
    await as(sam)
      .post(`/contests/${id}/questions/${qid}/submissions`, {
        language: 'javascript',
        code: RIGHT,
      })
      .expect(429);
  });

  it('waits for the judge, then scores the last submission of each entrant', async () => {
    const id = await codeContest();
    const ana = await enter(id, 'ana');
    const ben = await enter(id, 'ben');
    await moveContest(t, id, -1);
    const qid = data<Workspace>(
      await as(ana).post(`/contests/${id}/start`).expect(200),
    ).questions[0]._id;
    await as(ben).post(`/contests/${id}/start`).expect(200);
    const path = `/contests/${id}/questions/${qid}/submissions`;

    // Ana gets it right, then submits a worse one: the last one counts.
    await as(ana)
      .post(path, { language: 'javascript', code: RIGHT })
      .expect(201);
    await judgeAll();
    await as(ana)
      .post(path, { language: 'javascript', code: PARTIAL })
      .expect(201);
    await judgeAll();
    // Ben's is still waiting when the contest ends.
    await as(ben)
      .post(path, { language: 'typescript', code: RIGHT })
      .expect(201);
    await moveContest(t, id, -31);

    const waiting = await finalize.finalizeDue(new Date());
    expect(waiting.waiting).toContain(id);
    expect((await contestDoc(t, id))?.finalizedAt).toBeNull();

    await judgeAll();
    await t.db
      .collection('contests')
      .updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { lockedUntil: null } },
      );
    const run = await finalize.finalizeDue(new Date());
    expect(run.finalized).toContain(id);

    const results = data<{
      contest: { format: string };
      top: { username: string; score: number; rank: number }[];
      questions: {
        kind: string;
        submission: { code: string; passed: number } | null;
        earned: number;
        explanation: string;
      }[];
    }>(await as(ana).get(`/contests/${id}/results`).expect(200));
    expect(results.top.map((r) => [r.username, r.score, r.rank])).toEqual([
      ['ben', 30, 1],
      ['ana', 20, 2],
    ]);
    expect(results.questions[0]).toMatchObject({
      kind: 'code',
      earned: 20,
      explanation: 'Add them up.',
      submission: { code: PARTIAL, passed: 2 },
    });
    expect(JSON.stringify(results)).not.toContain(HIDDEN_INPUT);
  });

  it('refuses submissions after the entrant finishes', async () => {
    const id = await codeContest();
    const sam = await enter(id, 'finisher');
    await moveContest(t, id, -1);
    const qid = data<Workspace>(
      await as(sam).post(`/contests/${id}/start`).expect(200),
    ).questions[0]._id;
    await as(sam).post(`/contests/${id}/submit`).expect(200);
    await as(sam)
      .post(`/contests/${id}/questions/${qid}/submissions`, {
        language: 'javascript',
        code: RIGHT,
      })
      .expect(409);
  });
});
