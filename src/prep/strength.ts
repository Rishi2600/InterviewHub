import {
  ALL_TOPICS,
  topicKind,
  type Level,
  type TopicKind,
} from '../common/topics';

/**
 * Weak areas: a strength per topic from recent results, no AI. The rules
 * and worked examples are in docs/PREP_DESIGN.md §5; the tests check them.
 */

export const STRENGTH = {
  windowDays: 90,
  halfLifeDays: 30,
  // One imaginary result of `prior` with weight `k`, so a single result
  // can't brand a topic weak on its own.
  k: 1,
  prior: 0.6,
  // Evidence needed before a topic is judged, and the weak line.
  minEvidence: 0.5,
  weakBelow: 0.5,
  suggestions: 3,
  // An area at or under this average is the focus for the coach.
  focusAtMost: 3,
} as const;

export type Source = 'review' | 'interview' | 'coach' | 'drill';

/** One finished thing, as evidence about one topic. */
export interface Evidence {
  source: Source;
  topic: string;
  at: Date;
  /** 0 (all wrong) to 1 (all right). */
  result: number;
  /** The source's weight, before fading with age. */
  weight: number;
  level: Level | null;
  /** 1 to 5 per area, from reviews, interviews and coach recaps. */
  areas: { name: string; score: number }[];
  /** Why it counts against the topic, as shown to the candidate. */
  why: string;
}

export interface TopicStrength {
  topic: string;
  kind: TopicKind;
  /** 0 to 1, or null when there isn't enough evidence yet. */
  strength: number | null;
  evidence: number;
  weak: boolean;
  /** The result that pulled it down most. */
  reason: { text: string; at: Date } | null;
  /** The area the coach should focus on, if one stands out. */
  focus: string | null;
  level: Level | null;
}

const DAY = 86_400_000;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fromFive = (score: number) => (score - 1) / 4;
const lowest = (areas: Evidence['areas']) =>
  areas.reduce((lo, a) => (a.score < lo.score ? a : lo));

// ── Building evidence from what the app stores ──────────────────────────────

interface Rated {
  topic: string;
  level: Level;
  endedAt: Date | null;
  startedAt: Date;
  feedback: {
    areas: { name: string; score: number }[];
    questions: unknown[];
  } | null;
}

/** A practice interview's feedback. Weight 1. */
export function fromInterview(iv: Rated): Evidence | null {
  return rated(iv, 'interview', 1, 'practice interview');
}

/** A coach session's recap. Weight 0.6, less for a short session. */
export function fromCoach(s: Rated): Evidence | null {
  const concepts = Math.max(1, s.feedback?.questions.length ?? 0);
  return rated(s, 'coach', 0.6 * Math.min(1, concepts / 5), 'coach session');
}

function rated(
  iv: Rated,
  source: Source,
  weight: number,
  name: string,
): Evidence | null {
  const areas = iv.feedback?.areas ?? [];
  if (!areas.length) return null;
  const low = lowest(areas);
  return {
    source,
    topic: iv.topic,
    at: iv.endedAt ?? iv.startedAt,
    result: fromFive(mean(areas.map((a) => a.score))),
    weight,
    level: iv.level,
    areas,
    why: `${low.score}/5 on ${low.name} in your ${iv.topic} ${name}`,
  };
}

/** A finished drill. Weight 0.5 for all 10 answered. */
export function fromDrill(d: {
  topic: string;
  level: Level;
  answered: number;
  right: number;
  total: number;
  endedAt: Date | null;
  startedAt: Date;
}): Evidence | null {
  if (!d.answered) return null;
  return {
    source: 'drill',
    topic: d.topic,
    at: d.endedAt ?? d.startedAt,
    result: d.right / d.answered,
    weight: 0.5 * Math.min(1, d.answered / Math.max(d.total, 10)),
    level: d.level,
    areas: [],
    why: `${d.right}/${d.answered} in a ${d.topic} drill`,
  };
}

/** An interviewer's review: weight 1.5, split across its topics. */
export function fromReview(r: {
  topics: string[];
  areas: { name: string; score: number }[];
  at: Date;
}): Evidence[] {
  if (!r.areas.length || !r.topics.length) return [];
  const low = lowest(r.areas);
  return r.topics.map((topic) => ({
    source: 'review' as const,
    topic,
    at: r.at,
    result: fromFive(mean(r.areas.map((a) => a.score))),
    weight: 1.5 / r.topics.length,
    level: null,
    areas: r.areas,
    why: `Interviewer review: ${low.score}/5 on ${low.name}`,
  }));
}

// ── The calculation ─────────────────────────────────────────────────────────

/** Every topic in the shared list, with its strength as of `now`. */
export function strengths(all: Evidence[], now: Date): TopicStrength[] {
  const { windowDays, halfLifeDays, k, prior, minEvidence, weakBelow } =
    STRENGTH;
  const recent = all.filter((e) => {
    const age = (now.getTime() - e.at.getTime()) / DAY;
    return age >= 0 && age <= windowDays;
  });
  return ALL_TOPICS.map((topic) => {
    const items = recent
      .filter((e) => e.topic === topic)
      .map((e) => {
        // Whole days, so everything from today counts fully.
        const age = Math.floor((now.getTime() - e.at.getTime()) / DAY);
        return { e, w: e.weight * 0.5 ** (age / halfLifeDays) };
      });
    const evidence = items.reduce((n, i) => n + i.w, 0);
    const judged = evidence >= minEvidence;
    const strength = judged
      ? (items.reduce((n, i) => n + i.w * i.e.result, 0) + k * prior) /
        (evidence + k)
      : null;
    const pull = items.reduce<(typeof items)[number] | null>(
      (top, i) =>
        !top || i.w * (1 - i.e.result) > top.w * (1 - top.e.result) ? i : top,
      null,
    );
    const newest = items.reduce<Evidence | null>(
      (n, i) => (i.e.level && (!n || i.e.at > n.at) ? i.e : n),
      null,
    );
    return {
      topic,
      kind: topicKind(topic)!,
      strength,
      evidence,
      weak: strength !== null && strength < weakBelow,
      reason: pull ? { text: pull.e.why, at: pull.e.at } : null,
      focus: focusArea(items),
      level: newest?.level ?? null,
    };
  });
}

/** The area with the lowest weighted average, if it is 3 or under. */
function focusArea(items: { e: Evidence; w: number }[]): string | null {
  const sums = new Map<string, { s: number; w: number }>();
  for (const { e, w } of items) {
    for (const a of e.areas) {
      const cur = sums.get(a.name) ?? { s: 0, w: 0 };
      sums.set(a.name, { s: cur.s + w * a.score, w: cur.w + w });
    }
  }
  let best: { name: string; avg: number } | null = null;
  for (const [name, { s, w }] of sums) {
    const avg = s / w;
    if (avg <= STRENGTH.focusAtMost && (!best || avg < best.avg)) {
      best = { name, avg };
    }
  }
  return best?.name ?? null;
}

/** The weakest topics, weakest first, leaving out the candidate's own picks. */
export function suggestions(
  topics: TopicStrength[],
  pinned: string[],
): TopicStrength[] {
  return topics
    .filter((t) => t.weak && !pinned.includes(t.topic))
    .sort((a, b) => a.strength! - b.strength! || b.evidence - a.evidence)
    .slice(0, STRENGTH.suggestions);
}
