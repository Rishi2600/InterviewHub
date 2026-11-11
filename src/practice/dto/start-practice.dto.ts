import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  PRACTICE_KINDS,
  PRACTICE_LANGUAGES,
  PRACTICE_LEVELS,
  PRACTICE_MINUTES,
  PRACTICE_MODES,
  type PracticeKind,
  type PracticeLanguage,
  type PracticeLevel,
  type PracticeMode,
} from '../practice.constants';

export class StartPracticeDto {
  @IsIn(PRACTICE_KINDS)
  kind: PracticeKind;

  // One of the kind's topics, or "Mixed"; checked against the kind.
  @IsString()
  @MaxLength(40)
  topic: string;

  @IsIn(PRACTICE_LEVELS)
  level: PracticeLevel;

  @IsIn(PRACTICE_MINUTES)
  minutes: number;

  // Technical interviews with a coding question.
  @IsOptional()
  @IsIn(PRACTICE_LANGUAGES)
  language?: PracticeLanguage;

  @IsOptional()
  @IsIn(PRACTICE_MODES)
  mode?: PracticeMode;
}
