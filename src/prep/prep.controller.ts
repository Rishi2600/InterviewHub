import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CoachService } from './coach.service';
import { DrillService } from './drill.service';
import { AnswerDrillDto } from './dto/answer-drill.dto';
import { SetFocusDto } from './dto/set-focus.dto';
import { StartCoachDto } from './dto/start-coach.dto';
import { StartDrillDto } from './dto/start-drill.dto';
import { PrepBudgetService } from './prep-budget.service';
import { PrepService } from './prep.service';

/** Interview prep: candidates only, each session private to its candidate. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Candidate)
@Controller('prep')
export class PrepController {
  constructor(
    private readonly prep: PrepService,
    private readonly drills: DrillService,
    private readonly coach: CoachService,
    private readonly budget: PrepBudgetService,
  ) {}

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.prep.overview(user);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query('before') before?: string) {
    return this.prep.history(user, before);
  }

  @Put('focus')
  setFocus(@CurrentUser() user: AuthUser, @Body() dto: SetFocusDto) {
    return this.prep.setFocus(user, dto.topics);
  }

  // Today's prep AI use against its budget.
  @Roles(Role.Admin)
  @Get('usage')
  usage() {
    return this.budget.today(new Date());
  }

  // A coach session; it then runs on /practice/:id and the practice socket.
  @Post('coach')
  startCoach(@CurrentUser() user: AuthUser, @Body() dto: StartCoachDto) {
    return this.coach.start(user, dto);
  }

  @Post('drills')
  startDrill(@CurrentUser() user: AuthUser, @Body() dto: StartDrillDto) {
    return this.drills.start(user, dto);
  }

  @Get('drills/:id')
  getDrill(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.drills.get(id, user);
  }

  @Post('drills/:id/answers')
  @HttpCode(200)
  answer(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AnswerDrillDto,
  ) {
    return this.drills.answer(id, user, dto);
  }

  @Post('drills/:id/end')
  @HttpCode(200)
  endDrill(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.drills.end(id, user);
  }

  @Post('drills/:id/questions/:questionId/flag')
  @HttpCode(200)
  flag(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.drills.flag(id, questionId, user);
  }
}
