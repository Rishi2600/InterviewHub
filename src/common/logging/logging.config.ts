import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';

// A client-sent id is reused only if it is short and plain, so it cannot
// inject anything into log lines.
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Reuses the caller's X-Request-Id or makes one, and echoes it back so a
 *  user can quote it when reporting a problem. */
export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}

/** Anything secret that could end up in a logged object. */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.accessToken',
  '*.refreshToken',
  '*.token',
];

type AuthedRequest = IncomingMessage & { user?: { userId?: string } };

export function loggingConfig(level: string, pretty: boolean): Params {
  return {
    pinoHttp: {
      level,
      // Readable lines locally; one JSON object per line everywhere else.
      transport: pretty
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,
      genReqId: requestId,
      redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
      // Only what is useful: no headers, so nothing secret by default.
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      // Read when the request finishes, after the JWT guard set req.user.
      customProps: (req) => ({
        userId: (req as AuthedRequest).user?.userId,
      }),
    },
  };
}
