//@ts-nocheck

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ContestsService } from './contests.service';
import { CreateContestDto } from './dto/create-contest.dto';
import { AwardScoreDto } from './dto/award-score.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('contests')
@UseGuards(JwtAuthGuard)
export class ContestsController {
  constructor(private contestsService: ContestsService) {}

  // POST /api/v1/contests
  @Post()
  create(@Body() dto: CreateContestDto, @CurrentUser() user: UserDocument) {
    return this.contestsService.create(dto, user);
  }

  // GET /api/v1/contests
  @Get()
  findAll() {
    return this.contestsService.findAll();
  }

  // GET /api/v1/contests/:id
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.contestsService.findById(id);
  }

  // POST /api/v1/contests/:id/join
  // Body: { roomId }
  @Post(':id/join')
  join(
    @Param('id') contestId: string,
    @Body('roomId') roomId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.contestsService.joinContest(contestId, roomId, user);
  }

  // POST /api/v1/contests/:id/activate
  @Post(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.contestsService.activateContest(id, user);
  }

  // POST /api/v1/contests/:id/score
  // Interviewer awards points to a candidate
  @Post(':id/score')
  awardScore(
    @Param('id') contestId: string,
    @Body() dto: AwardScoreDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.contestsService.awardScore(contestId, dto, user);
  }

  // POST /api/v1/contests/:id/end
  @Post(':id/end')
  end(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.contestsService.endContest(id, user);
  }
}