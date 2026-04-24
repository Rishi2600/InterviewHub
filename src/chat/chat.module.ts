import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGateway } from './chat/chat.gateway';
import { ChatService } from './chat.service';
import { Message, MessageSchema } from './schemas/message.schema';
import { RoomsModule } from '../rooms/rooms.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { WsJwtGuard } from '../common/ws-jwt.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    RoomsModule,
    AuthModule,  // provides JwtModule (exported from AuthModule)
    UsersModule, // WsJwtGuard needs UsersService
  ],
  providers: [ChatGateway, ChatService, WsJwtGuard],
  exports: [ChatService],
})
export class ChatModule {}