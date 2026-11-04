import { isAllowedOrigin, parseOrigins } from './cors';
import { envValidationSchema } from './env.validation';

describe('CORS origins', () => {
  it('parses a comma-separated list, trimming spaces and trailing slashes', () => {
    expect(parseOrigins(' https://a.com/, http://localhost:5173 ,')).toEqual([
      'https://a.com',
      'http://localhost:5173',
    ]);
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('allows listed origins and clients that send no Origin', () => {
    const allowed = ['http://localhost:5173'];
    expect(isAllowedOrigin('http://localhost:5173', allowed)).toBe(true);
    expect(isAllowedOrigin(undefined, allowed)).toBe(true);
    expect(isAllowedOrigin('https://evil.example', allowed)).toBe(false);
    expect(isAllowedOrigin('http://localhost:5173.evil.example', allowed)).toBe(
      false,
    );
  });

  it('rejects a wildcard in CORS_ORIGINS and defaults to the dev frontend', () => {
    const base = { MONGODB_URI: 'mongodb://x', JWT_SECRET: 'x'.repeat(16) };
    expect(
      envValidationSchema.validate({ ...base, CORS_ORIGINS: '*' }).error,
    ).toBeDefined();
    expect(envValidationSchema.validate(base).value.CORS_ORIGINS).toBe(
      'http://localhost:5173',
    );
  });
});
