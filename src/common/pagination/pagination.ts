import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QueryFilter, Types } from 'mongoose';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** `?limit=&cursor=` on any paged list. */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;
}

/**
 * One page, newest first. `nextCursor` is a bookmark to the last item: send it
 * back to get the items after it, or null when there are no more. `counts`
 * are the caller's totals per state, whatever the page or filter.
 */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  counts: Record<string, number>;
}

interface Bookmarkable {
  _id: Types.ObjectId;
  createdAt: Date;
}

/** A bookmark: a date and an id, base64url-encoded so clients treat it as
 *  opaque. */
export function encodeKeyCursor(at: Date, id: Types.ObjectId): string {
  return Buffer.from(
    JSON.stringify([at.toISOString(), id.toString()]),
  ).toString('base64url');
}

/**
 * Items strictly after the bookmark in a list sorted by `field` then `_id`,
 * both ascending (1) or both descending (-1). Dates can repeat, so the id
 * breaks ties.
 */
export function afterKeyCursor(
  field: string,
  cursor: string,
  direction: 1 | -1,
): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (!Array.isArray(parsed) || parsed.length !== 2) throw new Error();
    const [iso, id] = parsed as [unknown, unknown];
    const at = new Date(String(iso));
    if (Number.isNaN(at.getTime()) || !Types.ObjectId.isValid(String(id)))
      throw new Error();
    const _id = new Types.ObjectId(String(id));
    const past = direction === 1 ? '$gt' : '$lt';
    return {
      $or: [{ [field]: { [past]: at } }, { [field]: at, _id: { [past]: _id } }],
    };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}

/** The bookmark for a newest-first list: the last item's createdAt and id. */
export function encodeCursor(item: Bookmarkable): string {
  return encodeKeyCursor(item.createdAt, item._id);
}

/** Items strictly after the bookmark in newest-first order. */
export function afterCursor(cursor: string): QueryFilter<Bookmarkable> {
  return afterKeyCursor('createdAt', cursor, -1);
}

/** The field a list filters and counts by: rooms use `state`, contests `status`. */
type StateField = 'state' | 'status';

/** Newest first, with the id breaking ties, matching the bookmark. */
export const NEWEST_FIRST = { createdAt: -1, _id: -1 } as const;

/** The find conditions and size for one page. Fetch `fetch` rows: one more
 *  than the page, to know whether another page follows. */
export function pageQuery(
  scope: Record<string, unknown>,
  query: PageQueryDto & { state?: string; status?: string },
  field: StateField = 'state',
) {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const value = query[field];
  const filter = value ? { ...scope, [field]: value } : scope;
  const conditions = query.cursor
    ? { $and: [filter, afterCursor(query.cursor)] }
    : filter;
  return { conditions, limit, fetch: limit + 1 };
}

/** Counts per state over the caller's whole list, whatever the page. */
export function countByStatePipeline(
  scope: Record<string, unknown>,
  field: StateField = 'state',
) {
  return [{ $match: scope }, { $group: { _id: '$' + field, n: { $sum: 1 } } }];
}

/** Builds the page from the fetched rows and the grouped counts. */
export function toPage<T extends Bookmarkable>(
  rows: T[],
  limit: number,
  grouped: { _id: string; n: number }[],
  states: readonly string[],
): Page<T> {
  const items = rows.slice(0, limit);
  const counts = Object.fromEntries(states.map((s) => [s, 0]));
  for (const { _id, n } of grouped) counts[_id] = n;
  return {
    items,
    nextCursor:
      rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
    counts,
  };
}
