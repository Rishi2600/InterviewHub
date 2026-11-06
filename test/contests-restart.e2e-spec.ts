import { bearer, data, signUp, startApp, TestApp } from './helpers';
import { moveContest, publishContest, question } from './contest-helpers';
import { FinalizeService } from '../src/contests/finalize/finalize.service';

interface Workspace {
  questions: { _id: string }[];
  answers: Record<string, string[]>;
}

/**
 * Everything about a running contest lives in the database, so a server
 * restart mid-contest loses nothing: saved answers come back, and the
 * contest still finalizes on the new server.
 */
describe('restarting mid-contest (e2e)', () => {
  let after: TestApp | undefined;
  afterAll(() => after?.app.close());

  it('keeps answers across a restart and still finalizes', async () => {
    const before = await startApp();
    const host = await signUp(before, 'host', 'interviewer');
    const fan = await signUp(before, 'fan');
    const id = await publishContest(before, host, [
      question({ prompt: 'Q0' }),
      question({ prompt: 'Q1' }),
    ]);
    await before.api().post(`/contests/${id}/join`).set(bearer(fan));
    await moveContest(before, id, -1);
    const ws = data<Workspace>(
      await before
        .api()
        .post(`/contests/${id}/start`)
        .set(bearer(fan))
        .expect(200),
    );
    const [q0, q1] = ws.questions.map((q) => q._id);
    await before
      .api()
      .put(`/contests/${id}/answers/${q0}`)
      .set(bearer(fan))
      .send({ optionIds: ['a'] })
      .expect(200);

    await before.app.close();
    after = await startApp({ keepData: true });

    const back = data<Workspace>(
      await after
        .api()
        .post(`/contests/${id}/start`)
        .set(bearer(fan))
        .expect(200),
    );
    expect(back.questions.map((q) => q._id)).toEqual([q0, q1]);
    expect(back.answers[q0]).toEqual(['a']);
    await after
      .api()
      .put(`/contests/${id}/answers/${q1}`)
      .set(bearer(fan))
      .send({ optionIds: ['b'] })
      .expect(200);

    await moveContest(after, id, -40, 30);
    expect(
      (await after.app.get(FinalizeService).finalizeDue(new Date())).finalized,
    ).toContain(id);
    const results = data<{ me: { score: number; rank: number } }>(
      await after
        .api()
        .get(`/contests/${id}/results`)
        .set(bearer(fan))
        .expect(200),
    );
    expect(results.me).toMatchObject({ score: 1, rank: 1 });
  });
});
