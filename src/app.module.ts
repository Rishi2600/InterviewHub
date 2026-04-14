import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersService } from './users/users.service';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [AuthModule, UsersModule, RoomsModule],
  controllers: [AppController],
  providers: [AppService, UsersService],
})
export class AppModule {}
