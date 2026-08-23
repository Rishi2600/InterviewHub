import { IsIn, IsOptional } from 'class-validator';
import { ContestState } from '../schemas/contest.schema';

export class ListContestsDto {
  @IsOptional()
  @IsIn(['draft', 'active', 'ended'])
  state?: ContestState;
}
