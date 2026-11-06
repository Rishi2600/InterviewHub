import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/pagination';
import { LIMITS, Trim } from '../../common/validation/limits';

export const BROWSE_PHASES = ['live', 'upcoming', 'past'] as const;
export type BrowsePhase = (typeof BROWSE_PHASES)[number];

/** `?phase=live|upcoming|past&q=&limit=&cursor=` on the public list. */
export class BrowseContestsDto extends PageQueryDto {
  @IsIn(BROWSE_PHASES)
  phase: BrowsePhase;

  // Matches anywhere in the title, ignoring case.
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(LIMITS.title.max)
  q?: string;
}
