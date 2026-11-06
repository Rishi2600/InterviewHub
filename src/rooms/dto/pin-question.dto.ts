import { IsString, Length } from 'class-validator';
import { LIMITS } from '../../common/validation/limits';

export class PinQuestionDto {
  @IsString()
  @Length(1, LIMITS.text)
  question: string;
}
