import { IsInt, IsMongoId, Max, Min } from 'class-validator';
import { LIMITS } from '../../common/validation/limits';

export class ScoreDto {
  @IsMongoId()
  userId: string;

  @IsInt()
  @Min(-LIMITS.scoreDelta)
  @Max(LIMITS.scoreDelta)
  delta: number;
}
