/** What a practice interview can be set to, and its limits. */

export const PRACTICE_KINDS = ['technical', 'behavioural'] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

export const PRACTICE_LEVELS = ['junior', 'mid', 'senior'] as const;
export type PracticeLevel = (typeof PRACTICE_LEVELS)[number];

export const PRACTICE_MINUTES = [15, 30, 40] as const;
export type PracticeMinutes = (typeof PRACTICE_MINUTES)[number];

export const PRACTICE_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
] as const;
export type PracticeLanguage = (typeof PRACTICE_LANGUAGES)[number];

export const PRACTICE_MODES = ['chat', 'voice'] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

export const TOPICS: Record<PracticeKind, readonly string[]> = {
  technical: [
    'JavaScript',
    'TypeScript',
    'Python',
    'React',
    'Node.js',
    'SQL',
    'Data structures',
    'Algorithms',
    'Web basics',
  ],
  behavioural: [
    'Teamwork',
    'Conflict',
    'Ownership',
    'Failure and learning',
    'Leadership',
    'Deadlines',
  ],
};
/** Picks a topic at random on the server: models are poor at random. */
export const MIXED = 'Mixed';

/** The areas feedback scores, 1 to 5 each. */
export function feedbackAreas(
  kind: PracticeKind,
  coding: boolean,
): readonly string[] {
  if (kind === 'behavioural') {
    return [
      'Structure',
      'Ownership',
      'Communication',
      'Self-awareness',
      'Results',
    ];
  }
  return coding
    ? [
        'Knowledge',
        'Problem solving',
        'Code quality',
        'Edge cases',
        'Communication',
      ]
    : ['Knowledge', 'Problem solving', 'Depth', 'Edge cases', 'Communication'];
}

export const PRACTICE_LIMITS = {
  perMonth: 3,
  // Candidate answers per interview; the AI replies to each.
  maxAnswers: 40,
  answerChars: 2_000,
  // What the AI is shown of the candidate's code and Run output.
  codeChars: 3_000,
  runChars: 600,
  // Requests one full-length interview can use: an opening, a reply to
  // each answer, and the feedback.
  requestsPerInterview: 40 + 2,
  // Feedback that fails is retried this long, then given up.
  feedbackRetryMs: 24 * 60 * 60_000,
} as const;
