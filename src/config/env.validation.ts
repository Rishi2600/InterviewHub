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
  // Proxies in front of the app (1 behind a single load balancer). Decides
  // which X-Forwarded-For entry is the client IP; 0 ignores the header.
  TRUST_PROXY: Joi.number().integer().min(0).default(0),

  MONGODB_URI: Joi.string().required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),

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
});
