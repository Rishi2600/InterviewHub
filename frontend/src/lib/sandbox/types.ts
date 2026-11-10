// Mirrors the backend's src/judge/sandbox/types.ts.

export const CODE_LANGUAGES = ['python', 'javascript', 'typescript'] as const
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]

export const LANGUAGE_LABEL: Record<CodeLanguage, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
}

/** How one run of a program ended. */
export type RunVerdict = 'ok' | 'error' | 'time' | 'memory' | 'output'

export interface RunResult {
  verdict: RunVerdict
  stdout: string
  stderr: string
  ms: number
}

export interface RunLimits {
  timeMs: number
  memoryBytes: number
  outputBytes: number
}

export interface RunTask {
  language: CodeLanguage
  code: string
  stdin: string
  limits: RunLimits
}

/** How one test ended. */
export type TestVerdict = 'passed' | 'wrong' | 'time' | 'memory' | 'output' | 'error'
