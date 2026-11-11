import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from '../../common/validation/limits';
import { PRACTICE_LIMITS } from '../practice.constants';

// Code and Run output must fit in one socket message (32 KB).
const CODE_CHARS = 20_000;
const RUN_CHARS = 4_000;

export class PracticeJoinDto {
  @IsMongoId()
  interviewId: string;
}

export class PracticeAnswerDto {
  @IsMongoId()
  interviewId: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(PRACTICE_LIMITS.answerChars)
  text: string;

  // The editor's code, during a coding question.
  @IsOptional()
  @IsString()
  @MaxLength(CODE_CHARS)
  code?: string;
}

export class PracticeRunDto {
  @IsMongoId()
  interviewId: string;

  @IsString()
  @MaxLength(RUN_CHARS)
  input: string;

  @IsString()
  @MaxLength(RUN_CHARS)
  output: string;

  @IsIn(['ok', 'error', 'timeout'])
  status: 'ok' | 'error' | 'timeout';

  @IsInt()
  @Min(0)
  @Max(60_000)
  ms: number;
}
