import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SaveReviewDto } from '../dto/save-review.dto';
import { ReviewsService } from './reviews.service';

/** Interviewers' reviews of candidates, after a live interview. */
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // Reviews about the signed-in candidate.
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.reviews.mine(user);
  }

  // A room's reviews, as its reviewer or its candidate sees them.
  @Get('rooms/:roomId')
  forRoom(@Param('roomId') roomId: string, @CurrentUser() user: AuthUser) {
    return this.reviews.forRoom(roomId, user);
  }

  @Put('rooms/:roomId/:candidateId')
  save(
    @Param('roomId') roomId: string,
    @Param('candidateId') candidateId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveReviewDto,
  ) {
    return this.reviews.save(roomId, candidateId, user, dto);
  }
}
