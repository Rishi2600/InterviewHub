import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export const SIGNUP_ROLES = [Role.Candidate, Role.Interviewer];

export class RegisterDto {
  @IsString()
  @MinLength(2)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  // Admin is never self-assigned at sign-up.
  @IsOptional()
  @IsIn(SIGNUP_ROLES)
  role?: Role;
}
