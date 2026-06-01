//@ts-nocheck

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room, RoomSchema } from './schemas/room.schema';
import { RoomOwnerGuard } from '../common/room-owner.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Room.name, schema: RoomSchema }]),
  ],
  controllers: [RoomsController],
  // RoomOwnerGuard is a provider here because it injects the Room model
  // NestJS needs to know about it to resolve the @InjectModel dependency
  providers: [RoomsService, RoomOwnerGuard],
  exports: [RoomsService, RoomOwnerGuard],
})
export class RoomsModule {}