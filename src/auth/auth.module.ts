import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule, // AuthService needs UsersService to find/create users
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}