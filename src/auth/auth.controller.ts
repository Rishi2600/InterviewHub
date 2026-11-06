import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AuthResult, AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ClientInfo, SESSION_IDLE_MS } from './sessions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import {
  LOGIN_LIMIT,
  REFRESH_LIMIT,
  REGISTER_LIMIT,
} from '../common/throttle/limits';

export const REFRESH_COOKIE = 'ih_refresh';

@Controller('auth')
export class AuthController {
  // httpOnly keeps it from scripts; SameSite=Strict keeps other sites from
  // sending it; the path keeps it off every request except /auth/*.
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    this.cookieOptions = {
      httpOnly: true,
      secure: config.get<boolean>('COOKIE_SECURE') ?? true,
      sameSite: 'strict',
      path: '/auth',
    };
  }

  @Throttle(REGISTER_LIMIT)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.authService.register(dto, clientInfo(req)),
    );
  }

  @Throttle(LOGIN_LIMIT)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.authService.login(dto, clientInfo(req)),
    );
  }

  @Throttle(REFRESH_LIMIT)
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = readRefreshCookie(req);
    if (!token) throw new UnauthorizedException('Not signed in');
    try {
      return this.respond(
        res,
        await this.authService.refresh(token, clientInfo(req)),
      );
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = readRefreshCookie(req);
    if (token) await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
    return {};
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  /** Puts the refresh token in the cookie and returns the rest as the body. */
  private respond(res: Response, { refreshToken, ...body }: AuthResult) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.cookieOptions,
      maxAge: SESSION_IDLE_MS,
    });
    return body;
  }
}

function readRefreshCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.headers['user-agent'] ?? null, ip: req.ip ?? null };
}
