import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * HTTP authentication guard. Delegates to the 'jwt' passport strategy,
 * which validates the Bearer token and attaches the user to request.user.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
