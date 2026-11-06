import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RoomOwnerGuard } from '../common/guards/room-owner.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateStateDto } from './dto/update-state.dto';
import { PinQuestionDto } from './dto/pin-question.dto';
import { ListRoomsDto } from './dto/list-rooms.dto';

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // Only interviewers/admins may create rooms.
  @UseGuards(RolesGuard)
  @Roles(Role.Interviewer, Role.Admin)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(user.userId, dto.title);
  }

  // Rooms the caller owns or has joined, one page at a time.
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListRoomsDto) {
    return this.roomsService.listForUser(user, query);
  }

  // Owner, participants and admins only.
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.roomsService.findForMember(id, user);
  }

  @Post(':code/join')
  join(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.roomsService.joinByCode(code, user);
  }

  // Only the owner (or admin) may change room state.
  @UseGuards(RoomOwnerGuard)
  @Patch(':id/state')
  setState(@Param('id') id: string, @Body() dto: UpdateStateDto) {
    return this.roomsService.setState(id, dto.state);
  }

  @UseGuards(RoomOwnerGuard)
  @Patch(':id/pin')
  pin(@Param('id') id: string, @Body() dto: PinQuestionDto) {
    return this.roomsService.pinQuestion(id, dto.question);
  }

  @UseGuards(RoomOwnerGuard)
  @Patch(':id/unpin')
  unpin(@Param('id') id: string) {
    return this.roomsService.unpinQuestion(id);
  }
}
