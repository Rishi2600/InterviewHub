import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

// All routes here are prefixed with /api/v1/auth (global prefix + this prefix)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /api/v1/auth/register
  // No guard — this is a public endpoint
  // ValidationPipe automatically validates RegisterDto before this runs
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /api/v1/auth/login
  // No guard — public endpoint
  // Returns { access_token, user } — the client stores the token for future requests
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // GET /api/v1/auth/me
  // Protected — requires a valid JWT in Authorization: Bearer <token>
  // JwtAuthGuard runs JwtStrategy which queries MongoDB for the user
  // @CurrentUser() then extracts that user from req.user
  // Useful for the frontend to rehydrate the current session on page load
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: UserDocument) {
    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }
}