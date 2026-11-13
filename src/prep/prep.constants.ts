/** Prep's limits. Design: docs/PREP_DESIGN.md. */
export const PREP_LIMITS = {
  // Per candidate per UTC day.
  coachPerDay: 2,
  drillsPerDay: 10,
  // Questions in a drill, and written by one AI request.
  drillSize: 10,
  writeBatch: 10,
  // A question flagged as wrong by this many candidates is hidden.
  flagsToHide: 2,
  // A drill left this long is closed with what was answered.
  drillIdleMs: 24 * 60 * 60_000,
  focusTopics: 3,
  // Lengths of a written question.
  promptChars: 600,
  codeChars: 800,
  optionChars: 200,
  explanationChars: 600,
  // Requests and tokens set aside for writing one batch: a try and a retry.
  writeRequests: 2,
  writeTokens: 12_000,
} as const;

export const PREP_MODES = ['drill', 'coach'] as const;
export type PrepMode = (typeof PREP_MODES)[number];

/** A coach topic the candidate types. Not counted in recommendations. */
export const OWN_TOPIC = {
  min: 2,
  max: 60,
  pattern: /^[\p{L}\p{N}][\p{L}\p{N} .,+#&/()'-]*$/u,
} as const;
