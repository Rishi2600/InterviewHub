//@ts-nocheck

import { IsMongoId, IsNumber, IsPositive, IsString } from 'class-validator';

export class AwardScoreDto {
  @IsMongoId()
  userId: string;

  @IsString()
  username: string;

  // Points awarded for this answer — interviewer decides the value
  @IsNumber()
  @IsPositive()
  points: number;
}