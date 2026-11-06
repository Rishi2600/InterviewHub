import { Types } from 'mongoose';
import { bearer, data, TestApp, TestUser } from './helpers';

const MIN = 60_000;

export const question = (over: object = {}) => ({
  kind: 'single',
  prompt: 'What does useState return?',
  options: [
    { id: 'a', text: 'A value and a setter' },
    { id: 'b', text: 'A ref' },
    { id: 'c', text: 'A promise' },
  ],
  correctOptionIds: ['a'],
  explanation: 'It returns a pair.',
  ...over,
});

/** A contest published through the API, starting in an hour. */
export async function publishContest(
  t: TestApp,
  host: TestUser,
  questions: object[] = [question()],
  details: object = {},
): Promise<string> {
  const api = () => t.api();
  const { _id } = data<{ _id: string }>(
    await api()
      .post('/contests')
      .set(bearer(host))
      .send({ title: 'Quiz' })
      .expect(201),
  );
  await api()
    .patch(`/contests/${_id}`)
    .set(bearer(host))
    .send({
      description: 'A quiz.',
      startAt: new Date(Date.now() + 60 * MIN).toISOString(),
      durationMinutes: 30,
      ...details,
    })
    .expect(200);
  await api()
    .put(`/contests/${_id}/questions`)
    .set(bearer(host))
    .send({ questions })
    .expect(200);
  // Tests publish more than the free 2 a month; the limit has its own tests.
  await t.db
    .collection('host_usage')
    .deleteMany({ hostId: new Types.ObjectId(host.id) });
  await api().post(`/contests/${_id}/publish`).set(bearer(host)).expect(201);
  return _id;
}

/**
 * Moves the clock, by moving the contest instead: it now starts `startIn`
 * minutes from now (negative for the past) and runs `length`. Its entries'
 * times move by the same amount, so an entry that joined before the start,
 * or submitted a minute in, still did.
 */
export async function moveContest(
  t: TestApp,
  id: string,
  startIn: number,
  length = 30,
): Promise<void> {
  const _id = new Types.ObjectId(id);
  const before = await t.db.collection('contests').findOne({ _id });
  const startAt = new Date(Date.now() + startIn * MIN);
  const shift = startAt.getTime() - (before?.startAt as Date).getTime();
  await t.db.collection('contests').updateOne(
    { _id },
    {
      $set: {
        startAt,
        endAt: new Date(startAt.getTime() + length * MIN),
        durationMinutes: length,
      },
    },
  );
  // $add leaves null (never started or submitted) as null.
  await t.db.collection('contest_entries').updateMany({ contestId: _id }, [
    {
      $set: {
        joinedAt: { $add: ['$joinedAt', shift] },
        startedAt: { $add: ['$startedAt', shift] },
        submittedAt: { $add: ['$submittedAt', shift] },
      },
    },
  ]);
}

export const contestDoc = (t: TestApp, id: string) =>
  t.db.collection('contests').findOne({ _id: new Types.ObjectId(id) });
