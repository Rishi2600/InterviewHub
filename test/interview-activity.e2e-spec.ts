import { Types } from 'mongoose';
import { bearer, data, signUp, startApp, TestApp } from './helpers';

describe('interview activity (e2e)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await startApp();
  });
  afterAll(() => t.app.close());

  it('gives each candidate who joined one square when the room ends', async () => {
    const owner = await signUp(t, 'ivy', 'interviewer');
    const panel = await signUp(t, 'meera', 'interviewer');
    const sam = await signUp(t, 'sam');
    const room = data<{ _id: string; code: string }>(
      await t
        .api()
        .post('/rooms')
        .set(bearer(owner))
        .send({ title: 'Round 2' })
        .expect(201),
    );
    for (const user of [panel, sam]) {
      await t
        .api()
        .post(`/rooms/${room.code}/join`)
        .set(bearer(user))
        .expect(201);
    }
    const end = () =>
      t
        .api()
        .patch(`/rooms/${room._id}/state`)
        .set(bearer(owner))
        .send({ state: 'ended' })
        .expect(200);
    await end();
    // Ending again changes nothing.
    await end();

    const events = await t.db
      .collection('activity_events')
      .find({ kind: 'interview', refId: new Types.ObjectId(room._id) })
      .toArray();
    expect(events.map((e) => e.userId.toString())).toEqual([sam.id]);
    expect(events[0].data).toEqual({ title: 'Round 2' });
  });
});
