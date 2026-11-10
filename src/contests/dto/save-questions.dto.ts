import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LIMITS } from '../../common/validation/limits';
import {
  QUESTION_KINDS,
  QuestionKind,
} from '../schemas/contest-question.schema';
import { CODE_LANGUAGES, CodeLanguage } from '../../judge/sandbox/types';

const C = LIMITS.contest;
const CODE = LIMITS.code;

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

export class CodeTestDto {
  @IsString()
  @MaxLength(CODE.testBytes)
  input: string;

  @IsString()
  @MaxLength(CODE.testBytes)
  output: string;

  @IsBoolean()
  visible: boolean;
}

export class StarterCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(CODE.codeBytes)
  python?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CODE.codeBytes)
  javascript?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CODE.codeBytes)
  typescript?: string;
}

export class HostAnswerDto {
  @IsIn(CODE_LANGUAGES)
  language: CodeLanguage;

  @IsString()
  @MaxLength(CODE.codeBytes)
  code: string;
}

/** A quiz question (single or multiple choice) or a code question. A quiz
 *  prompt is limited to LIMITS.text; the service checks that. */
export class QuestionDto {
  @IsIn(QUESTION_KINDS)
  kind: QuestionKind;

  @IsString()
  @MaxLength(CODE.statement)
  prompt: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(C.options.max)
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(C.options.max)
  @IsString({ each: true })
  @MaxLength(C.optionId, { each: true })
  correctOptionIds?: string[];

  // --- Code questions only ---

  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.title.max)
  title?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StarterCodeDto)
  starterCode?: StarterCodeDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CODE.tests.max)
  @ValidateNested({ each: true })
  @Type(() => CodeTestDto)
  tests?: CodeTestDto[];

  @IsOptional()
  @IsInt()
  @Min(CODE.timeLimitMs.min)
  @Max(CODE.timeLimitMs.max)
  timeLimitMs?: number;

  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @ValidateNested()
  @Type(() => HostAnswerDto)
  hostAnswer?: HostAnswerDto | null;

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
  @ArrayMaxSize(Math.max(C.questions.max, CODE.questions.max))
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions: QuestionDto[];
}
