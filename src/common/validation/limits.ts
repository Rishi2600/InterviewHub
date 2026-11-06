import { Transform } from 'class-transformer';

/** Every input size limit in the app, in one place. */
export const LIMITS = {
  username: { min: 2, max: 32 },
  email: 254,
  loginPassword: 128,
  title: { min: 2, max: 80 },
  text: 2000,
  scoreDelta: 1000,
  bodyBytes: '100kb',
  socketMessageBytes: 16 * 1024,
} as const;

/** Socket payloads are validated like HTTP bodies: unknown fields rejected. */
export const WS_VALIDATION = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
};

/** Trims surrounding whitespace from a string field before it is validated. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
