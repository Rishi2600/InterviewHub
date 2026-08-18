import { IsString, MinLength } from 'class-validator';

export class PinQuestionDto {
  @IsString()
  @MinLength(1)
  question: string;
}
