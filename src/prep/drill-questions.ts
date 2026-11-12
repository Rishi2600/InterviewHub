import { createHash, randomInt } from 'crypto';
import type { AiMessage } from '../ai/ai.types';
import type { Level } from '../common/topics';
import { PREP_LIMITS } from './prep.constants';

/** What the AI writes for one batch of drill questions (strict JSON). */
export const QUESTION_SET_SCHEMA = {
  name: 'drill_questions',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['prompt', 'code', 'options', 'correct', 'explanation'],
          properties: {
            prompt: { type: 'string' },
            code: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            correct: { type: 'integer' },
            explanation: { type: 'string' },
          },
        },
      },
    },
  },
};

const LEVEL_HINT: Record<Level, string> = {
  junior: 'fundamentals and the common mistakes beginners make',
  mid: 'how things behave under the hood, trade-offs and debugging',
  senior: 'edge cases, performance and design trade-offs',
};

/** The request for one batch, avoiding the shelf's recent questions. */
export function writeMessages(
  topic: string,
  level: Level,
  avoid: string[],
): AiMessage[] {
  const n = PREP_LIMITS.writeBatch;
  const rules = [
    `You write multiple-choice questions for interview prep drills on ${topic}, at ${level} level: ${LEVEL_HINT[level]}.`,
    `Write ${n} questions. Each tests one idea that comes up in ${level} developer interviews. Mix concepts, reading short code, and spotting bugs. Make every question different.`,
    'Each question has exactly 4 options and exactly one correct answer. Wrong options are plausible mistakes, never jokes. Never use "all of the above" or "none of the above".',
    '`correct` is the index (0 to 3) of the right option.',
    `\`code\` is a short snippet of at most 12 lines when the question is about code, otherwise an empty string. Keep the prompt under ${PREP_LIMITS.promptChars} characters and each option under ${PREP_LIMITS.optionChars}.`,
    '`explanation` is 1 to 3 plain sentences: why the right answer is right and why the most tempting wrong one is wrong.',
    'Write plain text. Put identifiers in backticks. Be accurate: if you are not sure of an answer, write a different question.',
  ];
  if (avoid.length) {
    rules.push(
      `Do not repeat these existing questions:\n${avoid.map((q) => `- ${q}`).join('\n')}`,
    );
  }
  return [
    { role: 'system', content: rules.join('\n') },
    { role: 'user', content: `${n} questions on ${topic}, ${level} level.` },
  ];
}

export interface WrittenQuestion {
  prompt: string;
  code: string | null;
  options: { id: string; text: string }[];
  correct: string;
  explanation: string;
  hash: string;
}

/** Same question, whatever its spacing, case or punctuation. */
export function promptHash(prompt: string): string {
  const norm = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return createHash('sha256').update(norm).digest('hex').slice(0, 32);
}

const BANNED_OPTION = /\b(all|none) of the above\b/i;
const OPTION_IDS = ['a', 'b', 'c', 'd'];

/**
 * Checks a batch and keeps only sound questions: 4 distinct options, one
 * correct, an explanation, lengths within limits, no repeats (in the batch
 * or in `known`). Options are shuffled so the right one isn't always in
 * the same place. Returns [] for a reply that isn't the expected JSON.
 */
export function parseQuestionSet(
  text: string,
  known: ReadonlySet<string>,
  random: (n: number) => number = randomInt,
): WrittenQuestion[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];
  const seen = new Set(known);
  const out: WrittenQuestion[] = [];
  for (const item of list as Record<string, unknown>[]) {
    const q = checkOne(item);
    if (!q || seen.has(q.hash)) continue;
    seen.add(q.hash);
    out.push(shuffle(q, random));
  }
  return out;
}

interface Checked {
  prompt: string;
  code: string | null;
  options: string[];
  correct: number;
  explanation: string;
  hash: string;
}

function checkOne(item: Record<string, unknown>): Checked | null {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const prompt = str(item.prompt);
  const code = str(item.code);
  const explanation = str(item.explanation);
  const options = Array.isArray(item.options) ? item.options.map(str) : [];
  const correct = item.correct;
  const L = PREP_LIMITS;
  if (prompt.length < 10 || prompt.length > L.promptChars) return null;
  if (code.length > L.codeChars) return null;
  if (explanation.length < 10 || explanation.length > L.explanationChars) {
    return null;
  }
  if (options.length !== 4) return null;
  if (options.some((o) => !o || o.length > L.optionChars)) return null;
  if (options.some((o) => BANNED_OPTION.test(o))) return null;
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return null;
  if (!Number.isInteger(correct) || (correct as number) < 0) return null;
  if ((correct as number) > 3) return null;
  return {
    prompt,
    code: code || null,
    options,
    correct: correct as number,
    explanation,
    hash: promptHash(prompt + '\n' + code),
  };
}

/** Fisher–Yates over the options; ids a to d follow the shown order. */
function shuffle(q: Checked, random: (n: number) => number): WrittenQuestion {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    prompt: q.prompt,
    code: q.code,
    options: order.map((from, i) => ({
      id: OPTION_IDS[i],
      text: q.options[from],
    })),
    correct: OPTION_IDS[order.indexOf(q.correct)],
    explanation: q.explanation,
    hash: q.hash,
  };
}
