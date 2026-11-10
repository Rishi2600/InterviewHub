import { Transform } from 'class-transformer';

/** Every input size limit in the app, in one place. */
export const LIMITS = {
  username: { min: 2, max: 32 },
  email: 254,
  loginPassword: 128,
  title: { min: 2, max: 80 },
  text: 2000,
  contest: {
    questions: { min: 1, max: 50 },
    options: { min: 2, max: 6 },
    optionText: 300,
    optionId: 20,
    points: { min: 1, max: 100 },
    durationMinutes: { min: 10, max: 24 * 60 },
    capacity: 100_000,
    freePerMonth: 2,
    publishLeadMinutes: 15,
    // A contest counts toward scores when at least this many started it.
    ratedMinStarters: 10,
  },
  // Code contests and the interview editor. See docs/learning/sandbox/.
  code: {
    questions: { min: 1, max: 10 },
    codeBytes: 64 * 1024,
    tests: { max: 20 },
    testBytes: 16 * 1024,
    timeLimitMs: { min: 1_000, max: 5_000, default: 2_000 },
    roomRunMs: 5_000,
    memoryBytes: 256 * 1024 * 1024,
    outputBytes: 64 * 1024,
    submitsPerMinute: 10,
  },
  bodyBytes: '100kb',
  // The question editor saves the whole list at once: 50 quiz questions come
  // to about 300 KB of JSON, and 10 code questions with 20 tests each at
  // their limits to about 7 MB.
  questionsBodyBytes: '8mb',
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
