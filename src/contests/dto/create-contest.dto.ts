import { IsString, MinLength } from 'class-validator';

export class CreateContestDto {
  @IsString()
  @MinLength(2)
  title: string;
}
