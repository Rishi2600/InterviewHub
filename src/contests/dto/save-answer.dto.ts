import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';
import { LIMITS } from '../../common/validation/limits';

/** One question's picked options; an empty list clears the answer. */
export class SaveAnswerDto {
  @IsArray()
  @ArrayMaxSize(LIMITS.contest.options.max)
  @IsString({ each: true })
  @MaxLength(LIMITS.contest.optionId, { each: true })
  optionIds: string[];
}
