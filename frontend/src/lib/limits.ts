// Mirrors the backend's src/common/validation/limits.ts.
export const LIMITS = {
  username: { min: 2, max: 32 },
  title: { min: 2, max: 80 },
  text: 2000,
} as const
