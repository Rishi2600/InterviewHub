import { ExecutionContext } from '@nestjs/common';
import { ThrottlerOptions } from '@nestjs/throttler';

/** Every rate limit in the app. Routes and events pick one with @Throttle(). */

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Only applies where a route sets an `hourly` limit; skipped everywhere else. */
const hasOwnHourlyLimit = (context: ExecutionContext): boolean =>
  Reflect.getMetadata('THROTTLER:LIMIThourly', context.getHandler()) !==
  undefined;

export const THROTTLERS: ThrottlerOptions[] = [
  { name: 'default', ttl: MINUTE, limit: 120 },
  {
    name: 'hourly',
    ttl: HOUR,
    limit: Number.MAX_SAFE_INTEGER,
    skipIf: (context) => !hasOwnHourlyLimit(context),
  },
];

// HTTP, counted per IP.
export const LOGIN_LIMIT = {
  default: { limit: 5, ttl: MINUTE },
  hourly: { limit: 30, ttl: HOUR },
};
export const REGISTER_LIMIT = { hourly: { limit: 5, ttl: HOUR } };
export const AVATAR_LIMIT = { hourly: { limit: 10, ttl: HOUR } };

// WebSocket events, counted per user.
export const WS_SEND_LIMIT = { default: { limit: 5, ttl: 5 * SECOND } };
export const WS_TYPING_LIMIT = { default: { limit: 2, ttl: SECOND } };
export const WS_SUBSCRIBE_LIMIT = { default: { limit: 10, ttl: 10 * SECOND } };
export const WS_PIN_LIMIT = { default: { limit: 10, ttl: MINUTE } };

/** Open sockets allowed per user, per namespace. */
export const MAX_SOCKETS_PER_USER = 5;
