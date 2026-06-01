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
import { RolesGuard } from '../common/roles.guard';
import { RoomOwnerGuard } from '../common/room-owner.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  // Guard chain: JwtAuthGuard → RolesGuard → @Roles('interviewer')
  // Only interviewers can create rooms
  @Post()
  @UseGuards(RolesGuard)
  @Roles('interviewer')
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: UserDocument) {
    return this.roomsService.create(dto, user);
  }

  // Guard chain: JwtAuthGuard only
  // Any authenticated user can view a room
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.roomsService.findById(id);
  }

  // Guard chain: JwtAuthGuard only
  // Any authenticated user can join via a code
  @Post(':code/join')
  join(@Param('code') code: string, @CurrentUser() user: UserDocument) {
    return this.roomsService.join(code, user);
  }

  // Guard chain: JwtAuthGuard → RolesGuard → RoomOwnerGuard
  // Must be an interviewer AND the creator of this specific room
  @Patch(':id/state')
  @UseGuards(RolesGuard, RoomOwnerGuard)
  @Roles('interviewer')
  changeState(
    @Param('id') id: string,
    @Body() dto: UpdateRoomStateDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.roomsService.changeState(id, dto, user);
  }
}