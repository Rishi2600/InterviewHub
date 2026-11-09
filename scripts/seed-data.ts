// The people, quizzes and rooms that `npm run db:seed` creates.

export const SEED_DOMAIN = 'seed.interviewhub.dev';
export const SEED_PASSWORD = 'Seed@Pass123';

export interface SeedUser {
  key: string;
  username: string;
  role: 'candidate' | 'interviewer' | 'admin';
  // Chance of answering a question right, for candidates.
  skill?: number;
}

export const USERS: SeedUser[] = [
  { key: 'admin', username: 'Ava Admin', role: 'admin' },
  { key: 'priya', username: 'Priya Raman', role: 'interviewer' },
  { key: 'marcus', username: 'Marcus Lee', role: 'interviewer' },
  { key: 'hana', username: 'Hana Sato', role: 'interviewer' },
  { key: 'ada', username: 'Ada Okafor', role: 'candidate', skill: 0.95 },
  { key: 'jonah', username: 'Jonah Mensah', role: 'candidate', skill: 0.9 },
  { key: 'lena', username: 'Lena Schulz', role: 'candidate', skill: 0.85 },
  { key: 'rohan', username: 'Rohan Kapoor', role: 'candidate', skill: 0.8 },
  { key: 'mei', username: 'Mei Tanaka', role: 'candidate', skill: 0.78 },
  { key: 'diego', username: 'Diego Ortiz', role: 'candidate', skill: 0.72 },
  { key: 'samir', username: 'Samir Bose', role: 'candidate', skill: 0.68 },
  { key: 'nora', username: 'Nora Lind', role: 'candidate', skill: 0.65 },
  { key: 'theo', username: 'Theo Walsh', role: 'candidate', skill: 0.6 },
  { key: 'zara', username: 'Zara Ali', role: 'candidate', skill: 0.55 },
  { key: 'leo', username: 'Leo Novak', role: 'candidate', skill: 0.5 },
  { key: 'iris', username: 'Iris Chen', role: 'candidate', skill: 0.45 },
  { key: 'omar', username: 'Omar Haddad', role: 'candidate', skill: 0.4 },
  { key: 'ruth', username: 'Ruth Adeyemi', role: 'candidate', skill: 0.35 },
];

export interface SeedQuestion {
  prompt: string;
  options: string[];
  // Indexes into options; more than one makes it a multiple-choice question.
  correct: number[];
  points?: number;
  explanation?: string;
}

export type Timing =
  | { kind: 'ended'; daysAgo: number }
  | { kind: 'live' }
  | { kind: 'upcoming'; daysAhead: number }
  | { kind: 'draft' }
  | { kind: 'cancelled' };

export interface SeedContest {
  title: string;
  description: string;
  host: string;
  durationMinutes: number;
  timing: Timing;
  questions: SeedQuestion[];
}

export const CONTESTS: SeedContest[] = [
  {
    title: 'JavaScript Fundamentals',
    description: 'Scope, closures, equality and the event loop.',
    host: 'priya',
    durationMinutes: 30,
    timing: { kind: 'ended', daysAgo: 40 },
    questions: [
      {
        prompt: 'What does `typeof null` return?',
        options: ['"null"', '"object"', '"undefined"', '"number"'],
        correct: [1],
        explanation: 'A long-standing quirk kept for backwards compatibility.',
      },
      {
        prompt: 'Which of these are falsy?',
        options: ['0', '"0"', 'NaN', '[]', '""'],
        correct: [0, 2, 4],
        points: 2,
      },
      {
        prompt: 'What does `[1, 2, 3].map(String)` return?',
        options: ['["1", "2", "3"]', '[1, 2, 3]', '"1,2,3"', 'An error'],
        correct: [0],
      },
      {
        prompt:
          'In what order do these log: setTimeout(A, 0), Promise.resolve().then(B), console.log(C)?',
        options: ['A B C', 'C A B', 'C B A', 'B C A'],
        correct: [2],
        points: 2,
        explanation: 'Sync code, then microtasks, then timers.',
      },
      {
        prompt: 'Which keywords declare block-scoped variables?',
        options: ['var', 'let', 'const', 'function'],
        correct: [1, 2],
      },
      {
        prompt: 'What is `0.1 + 0.2 === 0.3`?',
        options: ['true', 'false'],
        correct: [1],
      },
    ],
  },
  {
    title: 'SQL Essentials',
    description: 'Joins, grouping and indexes.',
    host: 'marcus',
    durationMinutes: 45,
    timing: { kind: 'ended', daysAgo: 26 },
    questions: [
      {
        prompt: 'Which join keeps every row from the left table?',
        options: ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'SELF JOIN'],
        correct: [1],
      },
      {
        prompt: 'Which clause filters groups after aggregation?',
        options: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'],
        correct: [1],
      },
      {
        prompt: 'What does `COUNT(column)` skip?',
        options: ['Duplicates', 'NULL values', 'Zeros', 'Nothing'],
        correct: [1],
        points: 2,
      },
      {
        prompt: 'Which usually benefit from an index?',
        options: [
          'Columns in WHERE filters',
          'Join keys',
          'Columns never queried',
          'ORDER BY columns',
        ],
        correct: [0, 1, 3],
        points: 2,
      },
      {
        prompt: 'Which statement removes all rows but keeps the table?',
        options: [
          'DROP TABLE',
          'TRUNCATE TABLE',
          'ALTER TABLE',
          'DELETE DATABASE',
        ],
        correct: [1],
      },
    ],
  },
  {
    title: 'HTTP and the Web',
    description: 'Methods, status codes, caching and cookies.',
    host: 'priya',
    durationMinutes: 30,
    timing: { kind: 'ended', daysAgo: 14 },
    questions: [
      {
        prompt: 'Which methods are idempotent?',
        options: ['GET', 'POST', 'PUT', 'DELETE'],
        correct: [0, 2, 3],
        points: 2,
      },
      {
        prompt: 'Which status means "not signed in"?',
        options: ['401', '403', '404', '409'],
        correct: [0],
      },
      {
        prompt: 'Which cookie flag hides it from JavaScript?',
        options: ['Secure', 'HttpOnly', 'SameSite', 'Path'],
        correct: [1],
      },
      {
        prompt: 'What does `Cache-Control: no-store` mean?',
        options: [
          'Cache, but revalidate first',
          'Never store the response',
          'Store for one hour',
          'Only proxies may store it',
        ],
        correct: [1],
      },
      {
        prompt: 'Which header carries a bearer token?',
        options: ['Cookie', 'Authorization', 'Accept', 'Origin'],
        correct: [1],
      },
    ],
  },
  {
    title: 'Data Structures Warm-up',
    description: 'Big-O and picking the right structure.',
    host: 'hana',
    durationMinutes: 40,
    timing: { kind: 'ended', daysAgo: 3 },
    questions: [
      {
        prompt: 'Average lookup time in a hash map?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correct: [0],
      },
      {
        prompt: 'Which structure gives first-in, first-out order?',
        options: ['Stack', 'Queue', 'Heap', 'Set'],
        correct: [1],
      },
      {
        prompt: 'Which are O(log n) in a balanced binary search tree?',
        options: ['Search', 'Insert', 'Delete', 'Listing every key in order'],
        correct: [0, 1, 2],
        points: 2,
      },
      {
        prompt: 'Best structure for "always take the smallest next"?',
        options: ['Array', 'Linked list', 'Min-heap', 'Hash set'],
        correct: [2],
      },
      {
        prompt: 'Worst-case time of quicksort?',
        options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
        correct: [2],
        points: 2,
      },
    ],
  },
  {
    title: 'React Fundamentals',
    description: 'Hooks, rendering and state. Live now, join and play.',
    host: 'priya',
    durationMinutes: 180,
    timing: { kind: 'live' },
    questions: [
      {
        prompt: 'When does a `useEffect` with an empty dependency list run?',
        options: [
          'Every render',
          'Once after the first render',
          'Never',
          'Before render',
        ],
        correct: [1],
      },
      {
        prompt: 'Which cause a component to re-render?',
        options: [
          'Its state changes',
          'Its parent re-renders',
          'A ref changes',
          'Its props change',
        ],
        correct: [0, 1, 3],
        points: 2,
      },
      {
        prompt: 'Why do list items need a `key`?',
        options: [
          'For styling',
          'So React can match items between renders',
          'For accessibility',
          'It is optional and unused',
        ],
        correct: [1],
      },
      {
        prompt: 'Which hook memoizes a computed value?',
        options: ['useMemo', 'useCallback', 'useRef', 'useState'],
        correct: [0],
      },
      {
        prompt: 'Calling setState with the same value...',
        options: [
          'Always re-renders',
          'May skip the re-render',
          'Throws an error',
          'Resets the component',
        ],
        correct: [1],
      },
    ],
  },
  {
    title: 'TypeScript Types',
    description: 'Unions, generics and narrowing.',
    host: 'marcus',
    durationMinutes: 60,
    timing: { kind: 'upcoming', daysAhead: 1 },
    questions: [
      {
        prompt: 'What does `keyof { a: 1; b: 2 }` give?',
        options: ['"a" | "b"', '1 | 2', 'string', 'never'],
        correct: [0],
      },
      {
        prompt: 'Which narrow a union type?',
        options: ['typeof checks', 'in checks', 'instanceof', 'as casts'],
        correct: [0, 1, 2],
        points: 2,
      },
      {
        prompt: 'What is `unknown` safer than?',
        options: ['never', 'any', 'void', 'object'],
        correct: [1],
      },
      {
        prompt: 'What does `Partial<T>` do?',
        options: [
          'Makes every field optional',
          'Removes fields',
          'Makes fields readonly',
          'Picks one field',
        ],
        correct: [0],
      },
      {
        prompt: 'Which type has no values at all?',
        options: ['null', 'undefined', 'never', 'void'],
        correct: [2],
      },
    ],
  },
  {
    title: 'System Design Basics',
    description: 'Caching, queues, scaling and consistency.',
    host: 'hana',
    durationMinutes: 90,
    timing: { kind: 'upcoming', daysAhead: 7 },
    questions: [
      {
        prompt: 'Which help a read-heavy service scale?',
        options: ['Caching', 'Read replicas', 'A CDN', 'Bigger write locks'],
        correct: [0, 1, 2],
        points: 2,
      },
      {
        prompt: 'What does a message queue mainly give you?',
        options: [
          'Faster SQL',
          'Decoupled, buffered work',
          'Stronger passwords',
          'Smaller payloads',
        ],
        correct: [1],
      },
      {
        prompt: 'CAP: during a partition you must choose between...',
        options: [
          'Consistency and availability',
          'Latency and throughput',
          'Cost and speed',
          'Reads and writes',
        ],
        correct: [0],
      },
      {
        prompt: 'Which makes a retried request safe to repeat?',
        options: ['An idempotency key', 'A longer timeout', 'Gzip', 'HTTP/2'],
        correct: [0],
      },
      {
        prompt: 'Horizontal scaling means...',
        options: [
          'A bigger machine',
          'More machines',
          'A faster disk',
          'Fewer requests',
        ],
        correct: [1],
      },
    ],
  },
  {
    title: 'Git Essentials',
    description: 'Branches, merges and history. A draft ready to publish.',
    host: 'priya',
    durationMinutes: 30,
    timing: { kind: 'draft' },
    questions: [
      {
        prompt: 'Which command moves the current branch to another commit?',
        options: ['git reset', 'git add', 'git status', 'git fetch'],
        correct: [0],
      },
      {
        prompt: 'What does `git fetch` change?',
        options: [
          'Your working files',
          'Remote-tracking branches only',
          'Your current branch',
          'Nothing at all',
        ],
        correct: [1],
      },
      {
        prompt: 'Which rewrite history?',
        options: ['rebase', 'commit --amend', 'merge', 'reset --hard'],
        correct: [0, 1, 3],
        points: 2,
      },
    ],
  },
  {
    title: 'CSS Layout Quiz',
    description: 'Flexbox and grid. Cancelled by the host.',
    host: 'marcus',
    durationMinutes: 30,
    timing: { kind: 'cancelled' },
    questions: [
      {
        prompt: 'Which property makes a flex container wrap?',
        options: ['flex-wrap', 'flex-flow-wrap', 'wrap', 'overflow'],
        correct: [0],
      },
      {
        prompt: 'What does `grid-template-columns: 1fr 2fr` do?',
        options: [
          'Two equal columns',
          'Second column twice the first',
          'Two rows',
          'Nothing',
        ],
        correct: [1],
      },
    ],
  },
];

export const ROOMS = [
  {
    title: 'Frontend interview with Ada Okafor',
    owner: 'priya',
    guests: ['ada'],
    state: 'active' as const,
    pinnedQuestion:
      'Write debounce(fn, wait) that returns a function with a cancel() method. After cancel, nothing fires until the next call.',
    chat: [
      ['priya', 'Thanks for joining, Ada. The question is pinned at the top.'],
      ['ada', 'Should cancel() also drop a call that is waiting to fire?'],
      ['priya', 'Yes. After cancel, nothing fires until the next call.'],
      [
        'ada',
        'I will keep the timer id in the closure and clear it in cancel().',
      ],
    ],
  },
  {
    title: 'System design with Theo Walsh',
    owner: 'hana',
    guests: ['theo'],
    state: 'ended' as const,
    pinnedQuestion: 'Design a URL shortener that handles 10k writes a second.',
    chat: [
      ['hana', 'Start with the API, then the storage.'],
      ['theo', 'POST /links returns a short code; GET /:code redirects.'],
    ],
  },
  {
    title: 'Backend systems with Samir Bose',
    owner: 'marcus',
    guests: [],
    state: 'waiting' as const,
    pinnedQuestion: null,
    chat: [],
  },
];
