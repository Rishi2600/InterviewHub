// Mirrors the backend's src/judge/sandbox/compare.ts: Run must judge the
// examples exactly as Submit judges the hidden tests.
import type { RunResult, TestVerdict } from './types'

/** Trailing spaces on each line and blank lines at the end don't count. */
function normalize(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((line) => line.trimEnd())
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

export function sameOutput(actual: string, expected: string): boolean {
  return normalize(actual) === normalize(expected)
}

export function judge(run: RunResult, expected: string): TestVerdict {
  if (run.verdict !== 'ok') return run.verdict
  return sameOutput(run.stdout, expected) ? 'passed' : 'wrong'
}
