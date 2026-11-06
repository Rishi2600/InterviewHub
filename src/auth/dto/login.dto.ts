import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { LIMITS } from '../../common/validation/limits';

export class LoginDto {
  @IsEmail()
  @MaxLength(LIMITS.email)
  email: string;

  // The password policy applies when a password is set, not here, so
  // accounts made under older rules can still sign in.
  @IsString()
  @Length(1, LIMITS.loginPassword)
  password: string;
}
