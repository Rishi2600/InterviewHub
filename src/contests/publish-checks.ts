import { LIMITS } from '../common/validation/limits';
import type { Contest } from './schemas/contest.schema';
import type { ContestQuestion } from './schemas/contest-question.schema';

export interface PublishCheck {
  label: string;
  ok: boolean;
  // Which questions fail, for the editor to point at, e.g. "Question 3 has none".
  detail?: string;
}

type ContestFields = Pick<
  Contest,
  'format' | 'title' | 'description' | 'startAt' | 'durationMinutes'
>;
type QuestionFields = Pick<
  ContestQuestion,
  'kind' | 'prompt' | 'options' | 'correctOptionIds' | 'title' | 'tests'
>;
type Check = [label: string, ok: boolean, detail?: string];

const { questions: Q, options: O, durationMinutes: D } = LIMITS.contest;
const CQ = LIMITS.code.questions;

/** "Question 3" or "Questions 3 and 5", numbered from 1 in the host's order. */
function name(numbers: number[]): string | undefined {
  if (numbers.length === 0) return undefined;
  if (numbers.length === 1) return `Question ${numbers[0]}`;
  const last = numbers[numbers.length - 1];
  return `Questions ${numbers.slice(0, -1).join(', ')} and ${last}`;
}

function failing(
  questions: QuestionFields[],
  bad: (q: QuestionFields) => boolean,
  [one, many]: [string, string],
): PublishCheck['detail'] {
  const numbers = questions.flatMap((q, i) => (bad(q) ? [i + 1] : []));
  const who = name(numbers);
  return who && `${who} ${numbers.length === 1 ? one : many}`;
}

/** The checks the editor lists under "Before you publish". All must pass to
 *  publish, and keep passing for any edit made after publishing. */
export function publishChecks(
  contest: ContestFields,
  questions: QuestionFields[],
  now: Date,
): PublishCheck[] {
  const earliest = now.getTime() + LIMITS.contest.publishLeadMinutes * 60_000;
  const duration = contest.durationMinutes ?? 0;
  const checks: Check[] = [
    ['Title', contest.title.trim().length >= LIMITS.title.min],
    ['Description', contest.description.trim().length > 0],
    [
      `Starts at least ${LIMITS.contest.publishLeadMinutes} minutes from now`,
      !!contest.startAt && contest.startAt.getTime() >= earliest,
    ],
    [
      'Length between 10 minutes and 24 hours',
      duration >= D.min && duration <= D.max,
    ],
    ...(contest.format === 'code'
      ? codeChecks(questions)
      : quizChecks(questions)),
  ];
  return checks.map(([label, ok, detail]) =>
    detail ? { label, ok, detail } : { label, ok },
  );
}

function quizChecks(questions: QuestionFields[]): Check[] {
  const noCorrect = failing(questions, (q) => q.correctOptionIds.length === 0, [
    'has no correct option',
    'have no correct option',
  ]);
  const singleTwice = failing(
    questions,
    (q) => q.kind === 'single' && q.correctOptionIds.length > 1,
    ['has more than one', 'have more than one'],
  );
  const optionCount = failing(
    questions,
    (q) => q.options.length < O.min || q.options.length > O.max,
    [`needs ${O.min} to ${O.max} options`, `need ${O.min} to ${O.max} options`],
  );
  const blank = failing(
    questions,
    (q) => !q.prompt.trim() || q.options.some((o) => !o.text.trim()),
    ['has empty text', 'have empty text'],
  );
  return [
    [
      `${Q.min} to ${Q.max} questions`,
      questions.length >= Q.min && questions.length <= Q.max,
    ],
    [`${O.min} to ${O.max} options each`, !optionCount, optionCount],
    ['Every question has a correct option', !noCorrect, noCorrect],
    [
      'Single choice questions have one correct option',
      !singleTwice,
      singleTwice,
    ],
    ['Every question and option has text', !blank, blank],
  ];
}

function codeChecks(questions: QuestionFields[]): Check[] {
  const blank = failing(questions, (q) => !q.title.trim() || !q.prompt.trim(), [
    'has no title or statement',
    'have no title or statement',
  ]);
  const tests = failing(
    questions,
    (q) => !q.tests.some((t) => t.visible) || !q.tests.some((t) => !t.visible),
    ['needs a visible and a hidden test', 'need a visible and a hidden test'],
  );
  const noOutput = failing(
    questions,
    (q) => q.tests.some((t) => !t.output.trim()),
    [
      'has a test with no expected output',
      'have tests with no expected output',
    ],
  );
  return [
    [
      `${CQ.min} to ${CQ.max} questions`,
      questions.length >= CQ.min && questions.length <= CQ.max,
    ],
    ['Every question has a title and a statement', !blank, blank],
    ['Every question has at least 1 visible and 1 hidden test', !tests, tests],
    ['Every test has an expected output', !noOutput, noOutput],
  ];
}
