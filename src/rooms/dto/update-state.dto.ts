import { IsIn } from 'class-validator';

export class UpdateStateDto {
  @IsIn(['waiting', 'active', 'ended'])
  state: 'waiting' | 'active' | 'ended';
}
