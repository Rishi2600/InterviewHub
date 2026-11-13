import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';
import { PREP_LIMITS } from '../prep.constants';

export class SetFocusDto {
  // Topics from the shared list; checked in the service.
  @IsArray()
  @ArrayMaxSize(PREP_LIMITS.focusTopics)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  topics: string[];
}
