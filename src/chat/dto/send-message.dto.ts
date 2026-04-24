//@ts-nocheck

import { IsEnum, IsMongoId, IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsMongoId()
  roomId: string;

  @IsString()
  @MinLength(1)
  content: string;

  // text     → regular chat reply
  // question → interviewer asking a question (can be pinned)
  @IsEnum(['text', 'question'])
  type: 'text' | 'question';
}