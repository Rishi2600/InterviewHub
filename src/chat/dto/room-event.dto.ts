import { IsMongoId } from 'class-validator';

export class RoomEventDto {
  @IsMongoId()
  roomId: string;
}
