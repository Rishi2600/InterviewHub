import { Types } from 'mongoose';
import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';

interface Review {
  id: string;
  candidateId: string;
  reviewerName: string;
  topics: string[];
  areas: { name: string; score: number }[];
  note: string;
}
interface RoomReviews {
  role: 'reviewer' | 'candidate';
  open: boolean;
  candidates: { userId: string; username: string }[];
  reviews: Review[];
}

const REVIEW = {
  kind: 'technical',
  topics: ['JavaScript', 'React'],
  areas: [
    { name: 'Knowledge', score: 3 },
    { name: 'Problem solving', score: 2 },
  ],
  note: 'Talk through the plan before coding.',
};

describe('interview reviews (e2e)', () => {
  let t: TestApp;
  let owner: TestUser, panel: TestUser, sam: TestUser, lena: TestUser;
  let outsider: TestUser;
  let room: { _id: string; code: string };

  beforeAll(async () => {
    t = await startApp();
    owner = await signUp(t, 'rev_priya', 'interviewer');
    panel = await signUp(t, 'rev_meera', 'interviewer');
    sam = await signUp(t, 'rev_sam');
    lena = await signUp(t, 'rev_lena');
    outsider = await signUp(t, 'rev_omar');
    room = data(
      await t
        .api()
        .post('/rooms')
        .set(bearer(owner))
        .send({ title: 'Frontend screen' })
        .expect(201),
    );
    for (const u of [panel, sam, lena]) {
      await t.api().post(`/rooms/${room.code}/join`).set(bearer(u)).expect(201);
    }
  });
  afterAll(() => t.app.close());

  const save = (u: TestUser, candidate: TestUser, body: object = REVIEW) =>
    t
      .api()
      .put(`/reviews/rooms/${room._id}/${candidate.id}`)
      .set(bearer(u))
      .send(body);
  const forRoom = async (u: TestUser) =>
    data<RoomReviews>(
      await t
        .api()
        .get(`/reviews/rooms/${room._id}`)
        .set(bearer(u))
        .expect(200),
    );

  it('opens only once the room has ended', async () => {
    await save(owner, sam).expect(400);
    await t
      .api()
      .patch(`/rooms/${room._id}/state`)
      .set(bearer(owner))
      .send({ state: 'ended' })
      .expect(200);
    const view = await forRoom(owner);
    expect(view).toMatchObject({ role: 'reviewer', open: true });
    expect(view.candidates.map((c) => c.username).sort()).toEqual([
      'rev_lena',
      'rev_sam',
    ]);
  });

  it('lets each interviewer review each candidate, and change it', async () => {
    const first = data<Review>(await save(owner, sam).expect(200));
    expect(first).toMatchObject({
      reviewerName: 'rev_priya',
      topics: REVIEW.topics,
    });
    const changed = data<Review>(
      await save(owner, sam, {
        ...REVIEW,
        note: 'Better on second look.',
      }).expect(200),
    );
    expect(changed.id).toBe(first.id);
    await save(panel, sam).expect(200);
    expect(await t.db.collection('room_reviews').countDocuments()).toBe(2);
  });

  it('checks topics, areas and who is reviewed', async () => {
    await save(owner, sam, { ...REVIEW, topics: ['Teamwork'] }).expect(400);
    await save(owner, sam, {
      ...REVIEW,
      areas: [{ name: 'Charm', score: 3 }],
    }).expect(400);
    await save(owner, sam, {
      ...REVIEW,
      areas: [{ name: 'Knowledge', score: 6 }],
    }).expect(400);
    await save(owner, sam, { ...REVIEW, topics: [] }).expect(400);
    // Interviewers aren't reviewed, and candidates can't review.
    await save(owner, panel).expect(404);
    await save(sam, lena).expect(403);
  });

  it('shows a candidate only the reviews about them', async () => {
    const samView = await forRoom(sam);
    expect(samView.role).toBe('candidate');
    expect(samView.reviews).toHaveLength(2);
    expect((await forRoom(lena)).reviews).toHaveLength(0);
    const mine = data<Review[]>(
      await t.api().get('/reviews/mine').set(bearer(sam)).expect(200),
    );
    expect(mine.map((r) => r.reviewerName).sort()).toEqual([
      'rev_meera',
      'rev_priya',
    ]);
    // A reviewer sees only their own.
    expect((await forRoom(panel)).reviews).toHaveLength(1);
    // Not a member: the room doesn't exist for them.
    await t
      .api()
      .get(`/reviews/rooms/${room._id}`)
      .set(bearer(outsider))
      .expect(404);
  });

  it('closes a week after the room ends', async () => {
    await t.db
      .collection('rooms')
      .updateOne(
        { _id: new Types.ObjectId(room._id) },
        { $set: { endedAt: new Date(Date.now() - 8 * 86_400_000) } },
      );
    expect((await forRoom(owner)).open).toBe(false);
    await save(owner, lena).expect(400);
  });
});
