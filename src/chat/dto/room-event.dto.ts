import { IsString } from 'class-validator';

export class RoomEventDto {
  @IsString()
  roomId: string;
}
