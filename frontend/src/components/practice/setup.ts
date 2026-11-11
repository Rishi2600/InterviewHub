// The setup sentence's state, and how one change affects the others.
import type { CodeLanguage } from '@/lib/sandbox/types'
import type { PracticeKind, PracticeLevel, PracticeMode } from '@/types'
import { MIXED, languageFor } from './labels'

export interface Setup {
  kind: PracticeKind
  topic: string
  level: PracticeLevel
  minutes: number
  mode: PracticeMode
  coding: boolean
  language: CodeLanguage
}

export const DEFAULT_SETUP: Setup = {
  kind: 'technical',
  topic: 'Python',
  level: 'mid',
  minutes: 30,
  mode: 'chat',
  coding: true,
  language: 'python',
}

/** Changing the type resets the topic; a language topic sets the language. */
export function withChange(s: Setup, patch: Partial<Setup>): Setup {
  const next = { ...s, ...patch }
  if (patch.kind && patch.kind !== s.kind) {
    next.topic = patch.kind === 'technical' ? 'Python' : MIXED
    next.coding = patch.kind === 'technical'
  }
  if (patch.topic && next.kind === 'technical' && patch.topic !== MIXED) next.language = languageFor(patch.topic)
  return next
}
