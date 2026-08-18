import { IsInt, IsMongoId } from 'class-validator';

export class ScoreDto {
  @IsMongoId()
  userId: string;

  @IsInt()
  delta: number;
}
