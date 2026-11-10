import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OptionalAuth } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { ContestsService } from './contests.service';
import { ContestHostingService } from './contest-hosting.service';
import { ContestEntrantService } from './contest-entrant.service';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { Throttle } from '@nestjs/throttler';
import { ANSWER_LIMIT } from '../common/throttle/limits';
import { CreateContestDto } from './dto/create-contest.dto';
import { ListContestsDto } from './dto/list-contests.dto';
import { BrowseContestsDto } from './dto/browse-contests.dto';
import { PageQueryDto } from '../common/pagination/pagination';
import { UpdateContestDto } from './dto/update-contest.dto';
import { SaveQuestionsDto } from './dto/save-questions.dto';
import { CodeDto } from './dto/code.dto';

@UseGuards(JwtAuthGuard)
@Controller('contests')
export class ContestsController {
  constructor(
    private readonly contestsService: ContestsService,
    private readonly hosting: ContestHostingService,
    private readonly entrant: ContestEntrantService,
  ) {}

  @UseGuards(RolesGuard)
  @Roles(Role.Interviewer, Role.Admin)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContestDto) {
    return this.hosting.createDraft(user, dto.title, dto.format);
  }

  // Contests the caller hosts or has joined, one page at a time.
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListContestsDto) {
    return this.contestsService.listForUser(user, query);
  }

  // The public browse list: no sign-in needed. Declared before ':id'.
  @OptionalAuth()
  @Get('browse')
  browse(
    @Query() query: BrowseContestsDto,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.contestsService.browse(query, user);
  }

  // The details page for any signed-in user; drafts for the host and admins.
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contestsService.details(id, user);
  }

  // Once finalized, for any signed-in user.
  @Get(':id/results')
  results(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contestsService.results(id, user);
  }

  // The whole final board, a page at a time ("Show all").
  @Get(':id/leaderboard')
  leaderboard(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query() query: PageQueryDto,
  ) {
    return this.contestsService.leaderboard(id, user, query);
  }

  // --- Entrant side ---

  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.entrant.join(id, user);
  }

  // Before the start only.
  @Post(':id/leave')
  @HttpCode(204)
  leave(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.entrant.leave(id, user);
  }

  // Opens the workspace: marks the entrant started the first time, and
  // returns the questions in their own order, without the answer key.
  @Post(':id/start')
  @HttpCode(200)
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.entrant.start(id, user);
  }

  @Throttle(ANSWER_LIMIT)
  @Put(':id/answers/:questionId')
  saveAnswer(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.entrant.saveAnswer(id, questionId, dto.optionIds, user);
  }

  // Code contests: autosave the program for one question.
  @Throttle(ANSWER_LIMIT)
  @Put(':id/drafts/:questionId')
  saveDraft(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CodeDto,
  ) {
    return this.entrant.saveDraft(id, questionId, dto, user);
  }

  // Queue a program for judging against the hidden tests.
  @Post(':id/questions/:questionId/submissions')
  submitCode(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CodeDto,
  ) {
    return this.entrant.submitCode(id, questionId, dto, user);
  }

  @Get(':id/questions/:questionId/submissions')
  listSubmissions(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.entrant.listSubmissions(id, questionId, user);
  }

  // Finishes the entry: answers, or submissions, are final from here.
  @Post(':id/submit')
  @HttpCode(200)
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.entrant.submit(id, user);
  }

  // --- Host side: only the host or an admin; anyone else gets 404. ---

  // Everything the editor shows: details, questions with answers, the
  // publish checks and the free-contest count.
  @Get(':id/editor')
  editor(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.hosting.editor(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateContestDto,
  ) {
    return this.hosting.updateDetails(id, user, dto);
  }

  // Takes up to LIMITS.questionsBodyBytes; see app.setup.ts.
  @Put(':id/questions')
  saveQuestions(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveQuestionsDto,
  ) {
    return this.hosting.saveQuestions(id, user, dto.questions);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.hosting.publish(id, user);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.hosting.cancel(id, user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.hosting.deleteDraft(id, user);
  }
}
