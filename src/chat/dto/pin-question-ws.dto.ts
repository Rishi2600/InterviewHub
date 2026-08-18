import { IsOptional, IsString } from 'class-validator';

export class PinQuestionWsDto {
  @IsString()
  roomId: string;

  @IsOptional()
  @IsString()
  question?: string;
}
