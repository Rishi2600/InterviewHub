//@ts-nocheck

import { IsDateString, IsString, MinLength, IsOptional } from 'class-validator';

export class CreateContestDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;
}