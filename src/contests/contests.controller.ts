import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ContestsService } from './contests.service';
import { CreateContestDto } from './dto/create-contest.dto';
import { ScoreDto } from './dto/score.dto';

@UseGuards(JwtAuthGuard)
@Controller('contests')
export class ContestsController {
  constructor(private readonly contestsService: ContestsService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.Interviewer, Role.Admin)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContestDto) {
    return this.contestsService.create(user.userId, dto.title);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contestsService.findById(id);
  }

  @Get(':id/results')
  results(@Param('id') id: string) {
    return this.contestsService.results(id);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contestsService.setState(id, user.userId, user.role, 'active');
  }

  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contestsService.join(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Interviewer, Role.Admin)
  @Post(':id/score')
  score(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ScoreDto,
  ) {
    return this.contestsService.score(id, user.userId, user.role, dto.userId, dto.delta);
  }

  @Post(':id/end')
  end(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contestsService.end(id, user.userId, user.role);
  }
}
