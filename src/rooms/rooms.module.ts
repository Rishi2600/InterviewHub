import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './schemas/room.schema';
import { RoomReview, RoomReviewSchema } from './schemas/room-review.schema';
import { ReviewsController } from './reviews/reviews.controller';
import { ReviewsService } from './reviews/reviews.service';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: RoomReview.name, schema: RoomReviewSchema },
    ]),
    ActivityModule, // an interview event per candidate when a room ends
  ],
  controllers: [RoomsController, ReviewsController],
  providers: [RoomsService, ReviewsService],
  exports: [RoomsService, ReviewsService],
})
export class RoomsModule {}
