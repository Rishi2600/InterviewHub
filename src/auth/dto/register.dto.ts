//@ts-nocheck

import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class RegisterDto {

  @IsString()
  username: string;

  @IsEmail()
  email: string;

  // MinLength(6) is enforced here — AuthService never sees a short password
  // The raw password is only alive for the duration of this request
  // After bcrypt.hash() it is gone — we never store it anywhere
  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(['candidate', 'interviewer'])
  role: string;
}