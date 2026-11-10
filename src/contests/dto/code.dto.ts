import { IsIn, IsString, MaxLength } from 'class-validator';
import { LIMITS } from '../../common/validation/limits';
import { CODE_LANGUAGES, CodeLanguage } from '../../judge/sandbox/types';

/** A program for one code question: autosaved as a draft, or submitted. */
export class CodeDto {
  @IsIn(CODE_LANGUAGES)
  language: CodeLanguage;

  @IsString()
  @MaxLength(LIMITS.code.codeBytes)
  code: string;
}
