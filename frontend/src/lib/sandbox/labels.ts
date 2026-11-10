import type { TestVerdict } from './types'

export const VERDICT_LABEL: Record<TestVerdict, string> = {
  passed: 'Passed',
  wrong: 'Wrong answer',
  time: 'Time limit',
  memory: 'Memory limit',
  output: 'Output limit',
  error: 'Runtime error',
}
