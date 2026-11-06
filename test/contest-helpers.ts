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
 * Moves a contest in time instead of moving the clock: it now starts
 * `startIn` minutes from now (negative for the past) and runs `length`.
 * Entries joined "before" keep their real join time, which is fine for
 * ordering since it is still before the end.
 */
export async function moveContest(
  t: TestApp,
  id: string,
  startIn: number,
  length = 30,
): Promise<void> {
  const startAt = new Date(Date.now() + startIn * MIN);
  await t.db.collection('contests').updateOne(
    { _id: new Types.ObjectId(id) },
    {
      $set: {
        startAt,
        endAt: new Date(startAt.getTime() + length * MIN),
        durationMinutes: length,
      },
    },
  );
}

export const contestDoc = (t: TestApp, id: string) =>
  t.db.collection('contests').findOne({ _id: new Types.ObjectId(id) });
