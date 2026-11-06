import { Types } from 'mongoose';
import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';

describe('read authorization (e2e)', () => {
  let t: TestApp;
  let host: TestUser;
  let other: TestUser;
  beforeAll(async () => {
    t = await startApp();
    host = await signUp(t, 'host', 'interviewer');
    other = await signUp(t, 'other');
  });
  afterAll(() => t.app.close());

  it("shows another user's profile without their email", async () => {
    const seen = data(
      await t.api().get(`/users/${host.id}`).set(bearer(other)).expect(200),
    );
    expect(seen).not.toHaveProperty('email');
    const own = data(
      await t.api().get(`/users/${host.id}`).set(bearer(host)).expect(200),
    );
    expect(own).toHaveProperty('email', host.email);
  });

  it('shows a room to its members only', async () => {
    const room = data<{ _id: string; code: string }>(
      await t
        .api()
        .post('/rooms')
        .set(bearer(host))
        .send({ title: 'Private' })
        .expect(201),
    );
    await t.api().get(`/rooms/${room._id}`).set(bearer(other)).expect(404);
    await t
      .api()
      .post(`/rooms/${room.code}/join`)
      .set(bearer(other))
      .expect(201);
    await t.api().get(`/rooms/${room._id}`).set(bearer(other)).expect(200);
  });

  it('hides a draft contest from everyone but its host', async () => {
    const contest = data<{ _id: string }>(
      await t
        .api()
        .post('/contests')
        .set(bearer(host))
        .send({ title: 'Draft' })
        .expect(201),
    );
    const id = contest._id;
    await t.api().get(`/contests/${id}`).set(bearer(other)).expect(404);
    await t.api().get(`/contests/${id}/results`).set(bearer(other)).expect(404);
    await t.api().post(`/contests/${id}/join`).set(bearer(other)).expect(404);
    await t.api().get(`/contests/${id}`).set(bearer(host)).expect(200);

    // Published directly in the database; the publish flow has its own tests.
    const start = Date.now() + 60 * 60_000;
    await t.db.collection('contests').updateOne(
      { _id: new Types.ObjectId(id) },
      {
        $set: {
          status: 'published',
          startAt: new Date(start),
          endAt: new Date(start + 30 * 60_000),
        },
      },
    );
    await t.api().get(`/contests/${id}`).set(bearer(other)).expect(200);
    await t.api().post(`/contests/${id}/join`).set(bearer(other)).expect(201);
  });

  it('answers 404 to malformed ids', async () => {
    for (const path of [
      '/users/nope',
      '/rooms/nope',
      '/contests/nope/results',
    ]) {
      await t.api().get(path).set(bearer(other)).expect(404);
    }
  });
});
