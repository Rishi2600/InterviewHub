import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { LIMITS } from '../../common/validation/limits';

export class PinQuestionWsDto {
  @IsMongoId()
  roomId: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.text)
  question?: string;
}
