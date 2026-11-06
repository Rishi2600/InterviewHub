import { IsIn, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/pagination';
import { ROOM_STATES, RoomState } from '../schemas/room.schema';

export class ListRoomsDto extends PageQueryDto {
  @IsOptional()
  @IsIn(ROOM_STATES)
  state?: RoomState;
}
