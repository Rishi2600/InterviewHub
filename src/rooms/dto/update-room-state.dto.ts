//@ts-nocheck

import { IsEnum } from 'class-validator';

export class UpdateRoomStateDto {
  // Only these three transitions are valid
  // waiting → active (interviewer starts the session)
  // active  → ended  (interviewer ends the session)
  @IsEnum(['waiting', 'active', 'ended'])
  status: string;
}