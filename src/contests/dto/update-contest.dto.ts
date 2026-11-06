import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { LIMITS, Trim } from '../../common/validation/limits';

const { durationMinutes: D } = LIMITS.contest;

/** The editor's Details card. Send only what changed; null clears an
 *  optional field. */
export class UpdateContestDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(LIMITS.title.min, LIMITS.title.max)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.text)
  description?: string;

  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startAt?: Date | null;

  @IsOptional()
  @IsInt()
  @Min(D.min)
  @Max(D.max)
  durationMinutes?: number;

  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(LIMITS.contest.capacity)
  capacity?: number | null;
}
