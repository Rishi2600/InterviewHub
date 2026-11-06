import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { LIMITS, Trim } from '../../common/validation/limits';
import { IsValidPassword } from '../password-policy';

export const SIGNUP_ROLES = [Role.Candidate, Role.Interviewer];

export class RegisterDto {
  @Trim()
  @IsString()
  @Length(LIMITS.username.min, LIMITS.username.max)
  username: string;

  @IsEmail()
  @MaxLength(LIMITS.email)
  email: string;

  @IsValidPassword()
  password: string;

  // Admin is never self-assigned at sign-up.
  @IsOptional()
  @IsIn(SIGNUP_ROLES)
  role?: Role;
}
