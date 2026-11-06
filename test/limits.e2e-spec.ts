import { bearer, data, signUp, startApp, TestApp, TestUser } from './helpers';

describe('input limits (e2e)', () => {
  let t: TestApp;
  let host: TestUser;
  beforeAll(async () => {
    t = await startApp();
    host = await signUp(t, 'host', 'interviewer');
  });
  afterAll(() => t.app.close());

  const createRoom = (body: object) =>
    t.api().post('/rooms').set(bearer(host)).send(body);

  it('rejects unknown fields', async () => {
    const res = await createRoom({ title: 'Ok', ownerId: 'x' }).expect(400);
    expect(JSON.stringify(res.body)).toContain(
      'property ownerId should not exist',
    );
  });

  it('trims titles and holds them to 2-80 characters', async () => {
    const room = data<{ title: string }>(
      await createRoom({ title: '  Pairing  ' }).expect(201),
    );
    expect(room.title).toBe('Pairing');
    await createRoom({ title: 'x'.repeat(81) }).expect(400);
  });

  it('refuses bodies over 100 KB', async () => {
    await createRoom({ title: 'x'.repeat(150_000) }).expect(413);
  });

  it('answers 404 to a join code that cannot exist', async () => {
    await t
      .api()
      .post('/rooms/%7B%24ne%3A1%7D/join')
      .set(bearer(host))
      .expect(404);
  });
});
