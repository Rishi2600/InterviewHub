import { IsMongoId, IsString, Length } from 'class-validator';
import { LIMITS } from '../../common/validation/limits';

export class SendMessageDto {
  @IsMongoId()
  roomId: string;

  @IsString()
  @Length(1, LIMITS.text)
  content: string;
}
