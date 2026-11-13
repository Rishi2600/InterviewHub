import { IsIn, IsString, MaxLength } from 'class-validator';
import { LEVELS, type Level } from '../../common/topics';

export class StartDrillDto {
  // One of the technical topics; checked in the service.
  @IsString()
  @MaxLength(40)
  topic: string;

  @IsIn(LEVELS)
  level: Level;
}
