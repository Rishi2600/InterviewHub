//@ts-nocheck

import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomStateDto } from './dto/update-room-state.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('rooms')
@UseGuards(JwtAuthGuard) // every route in this controller requires a valid JWT
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  // POST /api/v1/rooms
  // Only interviewers can create — enforced inside RoomsService.create()
  @Post()
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: UserDocument) {
    return this.roomsService.create(dto, user);
  }

  // GET /api/v1/rooms/:id
  // Any authenticated user can fetch a room by its MongoDB _id
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.roomsService.findById(id);
  }

  // POST /api/v1/rooms/:code/join
  // Candidate enters the 5-char join code to enter a room
  // :code is the short code (e.g. "XK92T"), not the MongoDB _id
  @Post(':code/join')
  join(@Param('code') code: string, @CurrentUser() user: UserDocument) {
    return this.roomsService.join(code, user);
  }

  // PATCH /api/v1/rooms/:id/state
  // Interviewer transitions: waiting → active → ended
  @Patch(':id/state')
  changeState(
    @Param('id') id: string,
    @Body() dto: UpdateRoomStateDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.roomsService.changeState(id, dto, user);
  }
}