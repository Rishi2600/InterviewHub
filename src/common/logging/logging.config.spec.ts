import { Writable } from 'stream';
import pino from 'pino';
import { REDACTED_PATHS, requestId } from './logging.config';

function fakeExchange(headerId?: string) {
  const headers: Record<string, string> = {};
  const req = { headers: headerId ? { 'x-request-id': headerId } : {} };
  const res = { setHeader: (k: string, v: string) => (headers[k] = v) };
  return { req: req as never, res: res as never, headers };
}

describe('requestId', () => {
  it('reuses a plain incoming id and echoes it', () => {
    const { req, res, headers } = fakeExchange('abc-123');
    expect(requestId(req, res)).toBe('abc-123');
    expect(headers['X-Request-Id']).toBe('abc-123');
  });

  it('replaces a missing or unsafe id with a fresh one', () => {
    for (const bad of [undefined, 'has spaces\nnewline', 'x'.repeat(65)]) {
      const { req, res, headers } = fakeExchange(bad);
      const id = requestId(req, res);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(headers['X-Request-Id']).toBe(id);
    }
  });
});

describe('log redaction', () => {
  it('never writes passwords, tokens or auth headers', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const log = pino(
      { redact: { paths: REDACTED_PATHS, censor: '[redacted]' } },
      sink,
    );

    log.info({
      req: {
        headers: {
          authorization: 'Bearer secret-jwt',
          cookie: 'ih_refresh=r1',
        },
      },
      body: { email: 'a@example.com', password: 'Quiet-river9' },
      result: { accessToken: 'jwt-2', refreshToken: 'r2' },
    });

    const out = lines.join('');
    for (const secret of [
      'secret-jwt',
      'ih_refresh=r1',
      'Quiet-river9',
      'jwt-2',
      'r2"',
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('a@example.com');
  });
});
