import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { LIMITS, Trim } from '../../common/validation/limits';
import { CONTEST_FORMATS, ContestFormat } from '../schemas/contest.schema';

export class CreateContestDto {
  @Trim()
  @IsString()
  @Length(LIMITS.title.min, LIMITS.title.max)
  title: string;

  // Quiz unless asked for; fixed once the draft exists.
  @IsOptional()
  @IsIn(CONTEST_FORMATS)
  format?: ContestFormat;
}
