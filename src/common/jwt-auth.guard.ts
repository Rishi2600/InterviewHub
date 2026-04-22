import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// This is intentionally just two lines
// AuthGuard('jwt') does all the heavy lifting:
// 1. Extracts the token using ExtractJwt.fromAuthHeaderAsBearerToken()
// 2. Verifies signature with JWT_SECRET
// 3. Calls JwtStrategy.validate()
// 4. Attaches the returned user to req.user
// 5. If anything fails → throws 401 automatically
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}