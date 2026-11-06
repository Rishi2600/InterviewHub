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

/** The bookmark: the last item's createdAt and id, base64url-encoded so
 *  clients treat it as opaque. */
export function encodeCursor(item: Bookmarkable): string {
  return Buffer.from(
    JSON.stringify([item.createdAt.toISOString(), item._id.toString()]),
  ).toString('base64url');
}

/** Items strictly after the bookmark in newest-first order. createdAt can
 *  repeat, so the id breaks ties. */
export function afterCursor(cursor: string): QueryFilter<Bookmarkable> {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (!Array.isArray(parsed) || parsed.length !== 2) throw new Error();
    const [iso, id] = parsed as [unknown, unknown];
    const createdAt = new Date(String(iso));
    if (
      Number.isNaN(createdAt.getTime()) ||
      !Types.ObjectId.isValid(String(id))
    )
      throw new Error();
    const _id = new Types.ObjectId(String(id));
    return {
      $or: [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: _id } },
      ],
    };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}

/** Newest first, with the id breaking ties, matching the bookmark. */
export const NEWEST_FIRST = { createdAt: -1, _id: -1 } as const;

/** The find conditions and size for one page. Fetch `fetch` rows: one more
 *  than the page, to know whether another page follows. */
export function pageQuery(
  scope: Record<string, unknown>,
  query: PageQueryDto & { state?: string },
) {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const filter = query.state ? { ...scope, state: query.state } : scope;
  const conditions = query.cursor
    ? { $and: [filter, afterCursor(query.cursor)] }
    : filter;
  return { conditions, limit, fetch: limit + 1 };
}

/** Counts per state over the caller's whole list, whatever the page. */
export function countByStatePipeline(scope: Record<string, unknown>) {
  return [{ $match: scope }, { $group: { _id: '$state', n: { $sum: 1 } } }];
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
