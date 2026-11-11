import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { Connection } from 'mongoose';
import { io, Socket } from 'socket.io-client';
import request, { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { HttpThrottleGuard } from '../src/common/throttle/http-throttle.guard';
import { FinalizeJob } from '../src/contests/finalize/finalize.job';
import { PracticeJob } from '../src/practice/practice.job';
import { AiClient } from '../src/ai/ai.types';

export const ORIGIN = 'http://localhost:5173';
export const PASSWORD = 'Quiet-river9';

export interface TestApp {
  app: INestApplication;
  url: string;
  db: Connection;
  api: () => ReturnType<typeof request>;
}

/**
 * The real app, set up exactly as main.ts does, on a random port, with an
 * empty database. Rate limits are off so tests can sign in freely; they have
 * their own unit tests. The every-minute jobs are off too, and AI tests
 * pass a fake AI.
 */
export async function startApp(
  // A second server sharing the first one's database keeps its data.
  opts: { keepData?: boolean; ai?: AiClient } = {},
): Promise<TestApp> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(HttpThrottleGuard)
    .useValue({ canActivate: () => true })
    // No background jobs racing the tests: they call the services
    // themselves, with their own clock.
    .overrideProvider(FinalizeJob)
    .useValue({})
    .overrideProvider(PracticeJob)
    .useValue({});
  if (opts.ai) builder = builder.overrideProvider(AiClient).useValue(opts.ai);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  configureApp(app);
  await app.listen(0, '127.0.0.1');

  const db = app.get<Connection>(getConnectionToken());
  if (!opts.keepData) {
    await db.dropDatabase();
    await Promise.all(Object.values(db.models).map((m) => m.syncIndexes()));
  }

  const { port } = app.getHttpServer().address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  return { app, url, db, api: () => request(url) };
}

/** The payload inside the `{ success, data }` envelope. */
export function data<T>(res: Response): T {
  return (res.body as { data: T }).data;
}

export interface TestUser {
  id: string;
  email: string;
  username: string;
  token: string;
  /** The Set-Cookie value holding the refresh token. */
  cookie: string;
}

let counter = 0;

export async function signUp(
  t: TestApp,
  username: string,
  role: 'candidate' | 'interviewer' = 'candidate',
): Promise<TestUser> {
  counter += 1;
  const email = `${username.replace(/\W/g, '')}${counter}@example.com`;
  const res = await t
    .api()
    .post('/auth/register')
    .send({ username, email, password: PASSWORD, role })
    .expect(201);
  const body = data<{ accessToken: string; user: { id: string } }>(res);
  return {
    id: body.user.id,
    email,
    username,
    token: body.accessToken,
    cookie: refreshCookie(res),
  };
}

/** The refresh cookie from a response, as `ih_refresh=...`. */
export function refreshCookie(res: Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith('ih_refresh='));
  if (!cookie) throw new Error('No refresh cookie in the response');
  return cookie.split(';')[0];
}

export const bearer = (user: TestUser) => ({
  Authorization: `Bearer ${user.token}`,
});

/** A connected socket for one namespace, signed in as `user`. */
export async function connectSocket(
  t: TestApp,
  namespace: string,
  user: TestUser,
): Promise<Socket> {
  const socket = io(`${t.url}${namespace}`, {
    auth: { token: user.token },
    transports: ['websocket'],
    extraHeaders: { origin: ORIGIN },
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

/** Resolves with the next payload of `event` on `socket`. */
export function nextEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}
