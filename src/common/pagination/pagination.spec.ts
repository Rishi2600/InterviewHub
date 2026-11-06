import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { afterCursor, encodeCursor, pageQuery, toPage } from './pagination';

const item = (iso: string) => ({
  _id: new Types.ObjectId(),
  createdAt: new Date(iso),
});

describe('pagination', () => {
  it('turns a bookmark back into "strictly after this item"', () => {
    const last = item('2026-11-06T10:00:00.000Z');
    expect(afterCursor(encodeCursor(last))).toEqual({
      $or: [
        { createdAt: { $lt: last.createdAt } },
        { createdAt: last.createdAt, _id: { $lt: last._id } },
      ],
    });
  });

  it.each(['garbage', Buffer.from('["x","y"]').toString('base64url')])(
    'rejects a cursor it did not make: %s',
    (cursor) => {
      expect(() => afterCursor(cursor)).toThrow(BadRequestException);
    },
  );

  it('fetches one extra row and adds the state filter', () => {
    const scope = { ownerId: 'u1' };
    expect(pageQuery(scope, { limit: 5, state: 'active' })).toEqual({
      conditions: { ownerId: 'u1', state: 'active' },
      limit: 5,
      fetch: 6,
    });
    expect(pageQuery(scope, {}).limit).toBe(20);
  });

  it('sets nextCursor only when another page follows, and fills every count', () => {
    const rows = [
      item('2026-11-06T03:00:00Z'),
      item('2026-11-06T02:00:00Z'),
      item('2026-11-06T01:00:00Z'),
    ];
    const states = ['waiting', 'active', 'ended'];

    const full = toPage(rows, 2, [{ _id: 'active', n: 7 }], states);
    expect(full.items).toHaveLength(2);
    expect(full.nextCursor).toBe(encodeCursor(rows[1]));
    expect(full.counts).toEqual({ waiting: 0, active: 7, ended: 0 });

    expect(toPage(rows, 3, [], states).nextCursor).toBeNull();
  });
});
