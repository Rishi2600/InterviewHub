import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ScoreViewerGuard } from '../common/guards/score-viewer.guard';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { PageQueryDto } from '../common/pagination/pagination';
import { UsersService } from '../users/users.service';
import { ScoreService } from './score.service';

export class ActivityQueryDto {
  // A calendar year; without it, the last 12 months.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

/** A candidate's score section, for the candidate, interviewers and admins. */
@UseGuards(JwtAuthGuard, ScoreViewerGuard)
@Controller('users')
export class ScoreController {
  constructor(
    private readonly scores: ScoreService,
    private readonly users: UsersService,
  ) {}

  @Get(':id/score')
  async score(@Param('id') id: string, @CurrentUser() viewer: AuthUser) {
    const user = await this.users.findById(id);
    return {
      user: {
        ...this.users.toPublic(user),
        joinedAt: user.get('createdAt') as Date,
      },
      ...(await this.scores.getScore(user._id, viewer.userId === id)),
    };
  }

  @Get(':id/activity')
  async activity(@Param('id') id: string, @Query() query: ActivityQueryDto) {
    const user = await this.users.findById(id);
    return this.scores.activity(
      user._id,
      user.get('createdAt') as Date,
      new Date(),
      query.year,
    );
  }

  @Get(':id/contests')
  async contests(@Param('id') id: string, @Query() query: PageQueryDto) {
    const user = await this.users.findById(id);
    return this.scores.contestHistory(user._id, query);
  }
}
