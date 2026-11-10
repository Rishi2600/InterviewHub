export const CODE_LANGUAGES = ['python', 'javascript', 'typescript'] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

/** How one run of a program ended. */
export type RunVerdict = 'ok' | 'error' | 'time' | 'memory' | 'output';

export interface RunResult {
  verdict: RunVerdict;
  stdout: string;
  stderr: string;
  ms: number;
}

export interface RunLimits {
  timeMs: number;
  memoryBytes: number;
  outputBytes: number;
}

/** How one hidden test ended. Only this and the time reach the entrant. */
export type TestVerdict =
  'passed' | 'wrong' | 'time' | 'memory' | 'output' | 'error';
