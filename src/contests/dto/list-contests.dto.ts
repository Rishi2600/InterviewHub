import { IsIn, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/pagination';
import { CONTEST_STATUSES, ContestStatus } from '../schemas/contest.schema';

export class ListContestsDto extends PageQueryDto {
  @IsOptional()
  @IsIn(CONTEST_STATUSES)
  status?: ContestStatus;
}
