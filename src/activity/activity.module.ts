import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActivityEvent,
  ActivityEventSchema,
} from './schemas/activity-event.schema';

/** Shares the activity_events model with the modules that write and read it. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityEvent.name, schema: ActivityEventSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class ActivityModule {}
