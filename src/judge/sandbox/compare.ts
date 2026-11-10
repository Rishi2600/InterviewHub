import { RunResult, TestVerdict } from './types';

/** Trailing spaces on each line and blank lines at the end don't count. */
function normalize(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const trimmed = lines.map((line) => line.trimEnd());
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
    trimmed.pop();
  }
  return trimmed.join('\n');
}

export function sameOutput(actual: string, expected: string): boolean {
  return normalize(actual) === normalize(expected);
}

/** A run's verdict against one test's expected output. */
export function judge(run: RunResult, expected: string): TestVerdict {
  if (run.verdict !== 'ok') return run.verdict;
  return sameOutput(run.stdout, expected) ? 'passed' : 'wrong';
}
