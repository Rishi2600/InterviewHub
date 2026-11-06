import {
  bearer,
  data,
  PASSWORD,
  refreshCookie,
  signUp,
  startApp,
  TestApp,
} from './helpers';

describe('auth and sessions (e2e)', () => {
  let t: TestApp;
  beforeAll(async () => (t = await startApp()));
  afterAll(() => t.app.close());

  const refresh = (cookie: string) =>
    t.api().post('/auth/refresh').set('Cookie', cookie);

  it('signs up with a token in the body and the refresh token in a locked-down cookie', async () => {
    const res = await t
      .api()
      .post('/auth/register')
      .send({ username: 'ada', email: 'ada@example.com', password: PASSWORD })
      .expect(201);
    expect(data<{ accessToken: string }>(res).accessToken).toBeTruthy();
    const header = (res.headers['set-cookie'] as unknown as string[])[0];
    expect(header).toMatch(/^ih_refresh=/);
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/Secure/);
    expect(header).toMatch(/SameSite=Strict/);
    expect(header).toMatch(/Path=\/auth/);
  });

  it('refuses admin sign-ups and weak passwords', async () => {
    await t
      .api()
      .post('/auth/register')
      .send({
        username: 'eve',
        email: 'eve@example.com',
        password: PASSWORD,
        role: 'admin',
      })
      .expect(400);
    await t
      .api()
      .post('/auth/register')
      .send({ username: 'eve', email: 'eve2@example.com', password: 'secret1' })
      .expect(400);
  });

  it('signs in with the right password only', async () => {
    const user = await signUp(t, 'bob');
    await t
      .api()
      .post('/auth/login')
      .send({ email: user.email, password: 'Wrong-pass99' })
      .expect(401);
    await t
      .api()
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(201);
  });

  it('protects /auth/me with the access token', async () => {
    const user = await signUp(t, 'cleo');
    await t.api().get('/auth/me').expect(401);
    const res = await t.api().get('/auth/me').set(bearer(user)).expect(200);
    expect(data<{ userId: string }>(res).userId).toBe(user.id);
  });

  it('rotates the refresh token on every refresh', async () => {
    const user = await signUp(t, 'dev');
    const res = await refresh(user.cookie).expect(200);
    const next = refreshCookie(res);
    expect(next).not.toBe(user.cookie);
    expect(data<{ accessToken: string }>(res).accessToken).toBeTruthy();
    await refresh(next).expect(200);
  });

  it('ends every session when a replaced token is reused', async () => {
    const user = await signUp(t, 'finn');
    const current = refreshCookie(await refresh(user.cookie).expect(200));
    // Age the swap past the 10-second grace window.
    await t.db
      .collection('sessions')
      .updateMany({}, { $set: { rotatedAt: new Date(Date.now() - 60_000) } });

    await refresh(user.cookie).expect(401);
    await refresh(current).expect(401);
  });

  it('does not treat two tabs refreshing at once as theft', async () => {
    const user = await signUp(t, 'gia');
    const current = refreshCookie(await refresh(user.cookie).expect(200));
    await refresh(user.cookie).expect(401);
    await refresh(current).expect(200);
  });

  it('ends the session on logout', async () => {
    const user = await signUp(t, 'hal');
    await t.api().post('/auth/logout').set('Cookie', user.cookie).expect(200);
    await refresh(user.cookie).expect(401);
  });
});
