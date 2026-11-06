import { Types } from 'mongoose';
import { phaseOf } from './contest-views';
import type { Contest } from './schemas/contest.schema';

const START = new Date('2026-11-10T12:00:00Z');
const END = new Date('2026-11-10T12:30:00Z');

const contest = (over: Partial<Contest> = {}) =>
  ({
    _id: new Types.ObjectId(),
    status: 'published',
    startAt: START,
    endAt: END,
    finalizedAt: null,
    ...over,
  }) as Contest & { _id: Types.ObjectId };

describe('phaseOf', () => {
  it('follows the clock for a published contest', () => {
    const at = (iso: string) => phaseOf(contest(), new Date(iso));
    expect(at('2026-11-10T11:59:59Z')).toBe('upcoming');
    expect(at('2026-11-10T12:00:00Z')).toBe('live');
    expect(at('2026-11-10T12:29:59Z')).toBe('live');
    expect(at('2026-11-10T12:30:00Z')).toBe('pending');
  });

  it('is ended once results are out', () => {
    expect(phaseOf(contest({ finalizedAt: END }), END)).toBe('ended');
  });

  it('reports drafts and cancelled contests whatever the time', () => {
    expect(phaseOf(contest({ status: 'draft' }), END)).toBe('draft');
    expect(phaseOf(contest({ status: 'cancelled' }), START)).toBe('cancelled');
  });
});
