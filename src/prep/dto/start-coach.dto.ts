import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  LEVELS,
  TOPIC_KINDS,
  type Level,
  type TopicKind,
} from '../../common/topics';
import { OWN_TOPIC } from '../prep.constants';
import { Transform } from 'class-transformer';
import {
  PRACTICE_LANGUAGES,
  PRACTICE_MODES,
  type PracticeLanguage,
  type PracticeMode,
} from '../../practice/practice.constants';

export class StartCoachDto {
  // A topic from the shared list, or the candidate's own: a short name in
  // plain words, so it can't carry instructions to the AI.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @MinLength(OWN_TOPIC.min)
  @MaxLength(OWN_TOPIC.max)
  @Matches(OWN_TOPIC.pattern, {
    message: 'Use letters, numbers, spaces and simple punctuation',
  })
  topic: string;

  // Only for the candidate's own topic: technical or behavioural.
  @IsOptional()
  @IsIn(TOPIC_KINDS)
  kind?: TopicKind;

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
