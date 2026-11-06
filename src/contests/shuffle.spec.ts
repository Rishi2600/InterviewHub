import { seededShuffle } from './shuffle';

const items = Array.from({ length: 20 }, (_, i) => i);

describe('seededShuffle', () => {
  it('gives the same order for the same seed', () => {
    expect(seededShuffle(items, 'entry-1')).toEqual(
      seededShuffle(items, 'entry-1'),
    );
  });

  it('keeps every item and leaves the input alone', () => {
    const copy = [...items];
    const out = seededShuffle(items, 'entry-1');
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual(copy);
  });

  it('gives different seeds different orders', () => {
    const orders = new Set(
      ['a', 'b', 'c', 'd', 'e'].map((s) => seededShuffle(items, s).join(',')),
    );
    expect(orders.size).toBe(5);
  });
});
