import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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

  // Published contests for any signed-in user; drafts for the host and admins.
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contestsService.findVisible(id, user);
  }

  @Get(':id/results')
  results(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contestsService.results(id, user);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contestsService.join(id, user);
  }
}
