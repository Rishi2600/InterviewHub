import * as Joi from 'joi';

/**
 * Joi schema for .env. The app refuses to boot with an invalid/missing
 * required variable, so misconfiguration fails fast and loudly.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  // Proxies in front of the app (1 behind a single load balancer). Decides
  // which X-Forwarded-For entry is the client IP; 0 ignores the header.
  TRUST_PROXY: Joi.number().integer().min(0).default(0),

  MONGODB_URI: Joi.string().required(),

  JWT_SECRET: Joi.string().min(16).required(),
  // Access token lifetime. Sessions last longer through the refresh cookie.
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  // Send the refresh cookie over HTTPS only. Browsers allow it on localhost.
  COOKIE_SECURE: Joi.boolean().default(true),

  REDIS_ENABLED: Joi.boolean().default(false),
  REDIS_URL: Joi.string().allow('').when('REDIS_ENABLED', {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.optional(),
  }),

  PUBLIC_BASE_URL: Joi.string().default('http://localhost:3000'),
  // Comma-separated browser origins allowed to call the API and open sockets.
  CORS_ORIGINS: Joi.string()
    .pattern(/^[^*]+$/, 'explicit origins (no "*")')
    .default('http://localhost:5173'),
  MAX_AVATAR_SIZE_BYTES: Joi.number().default(2097152),

  // Calls. With none of these set, calls connect only when both people can
  // reach each other directly, as on one network. See guides/calls.md.
  STUN_URLS: Joi.string().allow('').default(''),
  TURN_URLS: Joi.string().allow('').default(''),
  TURN_SECRET: Joi.string()
    .allow('')
    .when('TURN_URLS', {
      is: Joi.string().min(1),
      then: Joi.string().min(16).required(),
    }),
  TURN_TTL_SECONDS: Joi.number().integer().min(60).max(86_400).default(3_600),

  // AI practice interviews. Without a key the feature is switched off.
  // See guides/ai-practice.md.
  GROQ_API_KEY: Joi.string().allow('').default(''),
  // Tried in order: when one hits its limit, the next takes over.
  AI_MODELS: Joi.string().default('openai/gpt-oss-120b,openai/gpt-oss-20b'),
  // The app's own daily budget across all models, kept under Groq's free
  // limits. An interview starts only if a full-length one still fits.
  AI_DAILY_REQUESTS: Joi.number().integer().min(0).default(1_800),
  AI_DAILY_TOKENS: Joi.number().integer().min(0).default(360_000),
  // Tokens set aside when an interview starts; the unused rest is given back.
  AI_TOKENS_PER_INTERVIEW: Joi.number().integer().min(1_000).default(30_000),
  // Interviews running at once, to stay under the per-minute limits.
  AI_MAX_RUNNING: Joi.number().integer().min(1).default(5),
});
