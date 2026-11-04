import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { HttpThrottleGuard } from './http-throttle.guard';
import { LOGIN_LIMIT, REGISTER_LIMIT, THROTTLERS } from './limits';

@Controller()
class FakeController {
  @Throttle(LOGIN_LIMIT)
  @Post('login')
  login() {
    return 'ok';
  }

  @Throttle(REGISTER_LIMIT)
  @Post('register')
  register() {
    return 'ok';
  }

  @Get('open')
  open() {
    return 'ok';
  }
}

describe('HttpThrottleGuard', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: THROTTLERS })],
      controllers: [FakeController],
      providers: [
        HttpThrottleGuard,
        { provide: APP_GUARD, useExisting: HttpThrottleGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    // Listening once avoids supertest starting a server per request.
    await app.listen(0);
  });

  afterEach(() => app.close());

  const hit = (method: 'get' | 'post', path: string, times: number) =>
    Promise.all(
      Array.from({ length: times }, () =>
        request(app.getHttpServer())[method](path),
      ),
    );

  it('allows 5 logins a minute, then answers 429 with Retry-After', async () => {
    const ok = await hit('post', '/login', 5);
    expect(ok.every((r) => r.status === 201)).toBe(true);

    const blocked = await request(app.getHttpServer()).post('/login');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('allows 5 registrations an hour', async () => {
    await hit('post', '/register', 5);
    const blocked = await request(app.getHttpServer()).post('/register');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after-hourly'])).toBeGreaterThan(60);
  });

  it('keeps the general 120 a minute elsewhere, with no hourly cap', async () => {
    const res = await hit('get', '/open', 120);
    expect(res.every((r) => r.status === 200)).toBe(true);
    expect(res[0].headers['x-ratelimit-limit-hourly']).toBeUndefined();
    expect((await request(app.getHttpServer()).get('/open')).status).toBe(429);
  });

  it('ignores non-HTTP contexts', async () => {
    const guard = app.get(HttpThrottleGuard);
    const wsContext = {
      getType: () => 'ws',
      getHandler: () => function open() {},
      getClass: () => FakeController,
    } as never;
    await expect(guard.canActivate(wsContext)).resolves.toBe(true);
  });
});
