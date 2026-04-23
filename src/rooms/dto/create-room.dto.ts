//@ts-nocheck

import { IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(3)
  title: string;

  // contestId is optional — only set when this room is part of a contest
  // A plain interview room has no contestId
  @IsMongoId()
  @IsOptional()
  contestId?: string;
}