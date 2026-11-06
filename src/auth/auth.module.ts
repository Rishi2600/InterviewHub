import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SocketAuthService } from '../common/ws/socket-auth.service';
import { Session, SessionSchema } from './schemas/session.schema';
import { SessionsService } from './sessions.service';

/**
 * jsonwebtoken types `expiresIn` as a narrow literal union ("1d", "2h", ...),
 * which ConfigService.get<string>() cannot express. Joi validates the variable
 * at boot and defaults it to '15m', so the value is always a well-formed string
 * by the time this factory runs.
 */
type ExpiresIn = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

@Module({
  imports: [
    UsersModule,
    PassportModule,
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') as ExpiresIn,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, JwtStrategy, SocketAuthService],
  exports: [JwtModule, SocketAuthService],
})
export class AuthModule {}
