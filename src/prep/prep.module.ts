import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityModule } from '../activity/activity.module';
import { AiModule } from '../ai/ai.module';
import { CoachService } from './coach.service';
import { DrillService } from './drill.service';
import { PracticeModule } from '../practice/practice.module';
import { RoomsModule } from '../rooms/rooms.module';
import { PrepSharedModule } from './prep-shared.module';
import { PrepController } from './prep.controller';
import { PrepService } from './prep.service';
import { QuestionWriter } from './question-writer.service';
import { PrepDrill, PrepDrillSchema } from './schemas/prep-drill.schema';
import { PrepProfile, PrepProfileSchema } from './schemas/prep-profile.schema';
import {
  PrepQuestion,
  PrepQuestionSchema,
} from './schemas/prep-question.schema';

/** Interview prep: drills and the AI coach. See docs/PREP_DESIGN.md. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PrepQuestion.name, schema: PrepQuestionSchema },
      { name: PrepDrill.name, schema: PrepDrillSchema },
      { name: PrepProfile.name, schema: PrepProfileSchema },
    ]),
    ActivityModule, // a square on the activity graph
    AiModule,
    PrepSharedModule,
    PracticeModule, // coach sessions run on the practice engine
    RoomsModule, // interviewer reviews feed the weak areas
  ],
  controllers: [PrepController],
  providers: [QuestionWriter, DrillService, CoachService, PrepService],
})
export class PrepModule {}
