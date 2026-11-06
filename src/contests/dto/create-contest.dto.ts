import { IsString, Length } from 'class-validator';
import { LIMITS, Trim } from '../../common/validation/limits';

export class CreateContestDto {
  @Trim()
  @IsString()
  @Length(LIMITS.title.min, LIMITS.title.max)
  title: string;
}
