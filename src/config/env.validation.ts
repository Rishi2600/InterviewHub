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
  MAX_AVATAR_SIZE_BYTES: Joi.number().default(2097152),
});
