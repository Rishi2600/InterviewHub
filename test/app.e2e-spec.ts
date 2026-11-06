import { data, startApp, TestApp } from './helpers';

describe('health (e2e)', () => {
  let t: TestApp;
  beforeAll(async () => (t = await startApp()));
  afterAll(() => t.app.close());

  it('is live', async () => {
    const res = await t.api().get('/health/live').expect(200);
    expect(data(res)).toEqual({ status: 'ok' });
  });

  it('is ready with Mongo up, and Redis up when in use', async () => {
    const res = await t.api().get('/health/ready').expect(200);
    const redis = process.env.REDIS_ENABLED === 'true' ? 'up' : 'disabled';
    expect(data(res)).toEqual({
      status: 'ok',
      checks: { mongo: 'up', redis },
    });
  });

  it('returns a request id on every response', async () => {
    const res = await t
      .api()
      .get('/health/live')
      .set('X-Request-Id', 'trace-42')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('trace-42');
  });
});
