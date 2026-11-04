import { envValidationSchema } from './env.validation';

describe('env validation: TRUST_PROXY', () => {
  const base = { MONGODB_URI: 'mongodb://x', JWT_SECRET: 'x'.repeat(16) };
  const validate = (extra: object) =>
    envValidationSchema.validate({ ...base, ...extra });

  it('defaults to 0 (no proxy trusted)', () => {
    expect(validate({}).value.TRUST_PROXY).toBe(0);
  });

  it('accepts a hop count', () => {
    expect(validate({ TRUST_PROXY: '1' }).value.TRUST_PROXY).toBe(1);
  });

  it.each(['true', '-1', '1.5', '10.0.0.0/8'])('rejects %s', (bad) => {
    expect(validate({ TRUST_PROXY: bad }).error).toBeDefined();
  });
});
