import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PRACTICE_KINDS,
  type PracticeKind,
} from '../../practice/practice.constants';

export const REVIEW_NOTE_CHARS = 1_000;

export class ReviewAreaDto {
  // One of the kind's areas; checked in the service.
  @IsString()
  @MaxLength(40)
  name: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score: number;
}

export class SaveReviewDto {
  @IsIn(PRACTICE_KINDS)
  kind: PracticeKind;

  // 1 to 3 of the kind's topics; checked in the service.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  topics: string[];

  // The areas the interviewer saw; at least one.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ReviewAreaDto)
  areas: ReviewAreaDto[];

  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_NOTE_CHARS)
  note?: string;
}
