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
import { CreateContestDto } from './dto/create-contest.dto';
import { ListContestsDto } from './dto/list-contests.dto';
import { BrowseContestsDto } from './dto/browse-contests.dto';
import { UpdateContestDto } from './dto/update-contest.dto';
import { SaveQuestionsDto } from './dto/save-questions.dto';

@UseGuards(JwtAuthGuard)
@Controller('contests')
export class ContestsController {
  constructor(
    private readonly contestsService: ContestsService,
    private readonly hosting: ContestHostingService,
  ) {}

  @UseGuards(RolesGuard)
  @Roles(Role.Interviewer, Role.Admin)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContestDto) {
    return this.hosting.createDraft(user, dto.title);
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

  @Get(':id/results')
  results(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contestsService.results(id, user);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contestsService.join(id, user);
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
