import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Mongo answers or fails; Redis answers, fails, or is not configured. */
function controller(mongoOk: boolean, redis: 'up' | 'down' | 'disabled') {
  const mongo = {
    db: {
      admin: () => ({
        ping: () =>
          mongoOk ? Promise.resolve({}) : Promise.reject(new Error('no')),
      }),
    },
  };
  const redisClient =
    redis === 'disabled'
      ? null
      : {
          ping: () =>
            redis === 'up'
              ? Promise.resolve('PONG')
              : new Promise(() => undefined), // never answers
        };
  return new HealthController(
    new HealthService(mongo as never, redisClient as never),
  );
}

describe('health probes', () => {
  it('is live whatever the dependencies say', () => {
    expect(controller(false, 'down').live()).toEqual({ status: 'ok' });
  });

  it('is ready when Mongo is up and Redis is up or not in use', async () => {
    await expect(controller(true, 'disabled').ready()).resolves.toEqual({
      status: 'ok',
      checks: { mongo: 'up', redis: 'disabled' },
    });
    await expect(controller(true, 'up').ready()).resolves.toMatchObject({
      status: 'ok',
    });
  });

  it('answers 503 naming what is down, and treats a hung ping as down', async () => {
    await expect(controller(false, 'disabled').ready()).rejects.toThrow(
      new ServiceUnavailableException('mongo: down'),
    );
    await expect(controller(true, 'down').ready()).rejects.toThrow(
      'redis: down',
    );
  });
});
