import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AiBudgetService } from './ai-budget.service';
import { PracticeService } from './practice.service';
import { StartPracticeDto } from './dto/start-practice.dto';

/** AI practice interviews: candidates only, each private to its candidate. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Candidate)
@Controller('practice')
export class PracticeController {
  constructor(
    private readonly practice: PracticeService,
    private readonly budget: AiBudgetService,
  ) {}

  // The practice page: allowance, a running interview and the history.
  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.practice.overview(user);
  }

  @Post()
  start(@CurrentUser() user: AuthUser, @Body() dto: StartPracticeDto) {
    return this.practice.start(user, dto);
  }

  // Today's AI use against the budget. Declared before ':id'.
  @Roles(Role.Admin)
  @Get('usage')
  usage() {
    return this.budget.today(new Date());
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.practice.get(id, user);
  }

  @Post(':id/end')
  @HttpCode(200)
  end(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.practice.endByCandidate(id, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.practice.remove(id, user);
  }
}
