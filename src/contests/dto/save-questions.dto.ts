import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LIMITS } from '../../common/validation/limits';
import {
  QUESTION_KINDS,
  QuestionKind,
} from '../schemas/contest-question.schema';

const C = LIMITS.contest;

export class OptionDto {
  @IsString()
  @Length(1, C.optionId)
  @Matches(/^[\w-]+$/)
  id: string;

  // Blank text is allowed while editing; publishing checks it.
  @IsString()
  @MaxLength(C.optionText)
  text: string;
}

export class QuestionDto {
  @IsIn(QUESTION_KINDS)
  kind: QuestionKind;

  @IsString()
  @MaxLength(LIMITS.text)
  prompt: string;

  @IsArray()
  @ArrayMaxSize(C.options.max)
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options: OptionDto[];

  @IsArray()
  @ArrayMaxSize(C.options.max)
  @IsString({ each: true })
  @MaxLength(C.optionId, { each: true })
  correctOptionIds: string[];

  @IsOptional()
  @IsInt()
  @Min(C.points.min)
  @Max(C.points.max)
  points?: number;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.text)
  explanation?: string;
}

/** The whole question list, in the host's order. Saving replaces it. */
export class SaveQuestionsDto {
  @IsArray()
  @ArrayMaxSize(C.questions.max)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions: QuestionDto[];
}
