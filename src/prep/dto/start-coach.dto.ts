import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LEVELS, type Level } from '../../common/topics';
import {
  PRACTICE_LANGUAGES,
  PRACTICE_MODES,
  type PracticeLanguage,
  type PracticeMode,
} from '../../practice/practice.constants';

export class StartCoachDto {
  // A topic from the shared list; checked in the service.
  @IsString()
  @MaxLength(40)
  topic: string;

  @IsIn(LEVELS)
  level: Level;

  // An area to give extra attention to, such as "Edge cases".
  @IsOptional()
  @IsString()
  @MaxLength(40)
  focus?: string;

  // Technical topics: the language of a coding exercise, if any.
  @IsOptional()
  @IsIn(PRACTICE_LANGUAGES)
  language?: PracticeLanguage;

  @IsOptional()
  @IsIn(PRACTICE_MODES)
  mode?: PracticeMode;
}
