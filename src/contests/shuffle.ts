import { createHash } from 'crypto';

/**
 * A repeatable shuffle: the same seed always gives the same order, so an
 * entrant sees the same questions in the same order after a reload, and
 * nothing about the order needs storing.
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const next = mulberry32(
    createHash('sha256').update(seed).digest().readUInt32LE(0),
  );
  // Fisher–Yates.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A small, fast 32-bit PRNG. Not for secrets; only for stable ordering. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
