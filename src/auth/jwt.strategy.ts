//@ts-nocheck

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    config: ConfigService,
  ) {
    super({
      // Tell Passport where to find the token in the request
      // fromAuthHeaderAsBearerToken() looks at: Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // If the token is expired, reject it immediately — don't even call validate()
      ignoreExpiration: false,

      // The same secret used to SIGN tokens in AuthService.signToken()
      // Passport uses this to VERIFY the signature — if someone tampers
      // with the token payload, the signature won't match and it fails here
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  // This runs AFTER Passport has verified the token signature and expiry
  // payload is the decoded JWT payload — already trusted at this point
  // We do one final MongoDB check: confirm the user still exists
  // This handles the case where a user was deleted after their token was issued
  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    // Whatever we return here is attached to req.user
    // This is what @CurrentUser() will extract in controllers
    return user;
  }
}