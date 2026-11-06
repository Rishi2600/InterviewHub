// Mirrors the backend's src/common/validation/limits.ts.
export const LIMITS = {
  username: { min: 2, max: 32 },
  title: { min: 2, max: 80 },
  text: 2000,
  contest: {
    questions: 50,
    options: { min: 2, max: 6 },
    optionText: 300,
    points: { min: 1, max: 100 },
    durationMinutes: { min: 10, max: 24 * 60 },
    capacity: 100_000,
  },
} as const
