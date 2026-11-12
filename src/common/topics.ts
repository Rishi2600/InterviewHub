/**
 * The topics, levels and skill areas shared by practice interviews, prep
 * and interviewer reviews, so results from all of them line up.
 */

export const TOPIC_KINDS = ['technical', 'behavioural'] as const;
export type TopicKind = (typeof TOPIC_KINDS)[number];

export const LEVELS = ['junior', 'mid', 'senior'] as const;
export type Level = (typeof LEVELS)[number];

export const TOPICS: Record<TopicKind, readonly string[]> = {
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
export const ALL_TOPICS: readonly string[] = [
  ...TOPICS.technical,
  ...TOPICS.behavioural,
];

export const topicKind = (topic: string): TopicKind | null =>
  TOPICS.technical.includes(topic)
    ? 'technical'
    : TOPICS.behavioural.includes(topic)
      ? 'behavioural'
      : null;

/** The areas rated 1 to 5, in practice feedback and interviewer reviews. */
export function skillAreas(
  kind: TopicKind,
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
