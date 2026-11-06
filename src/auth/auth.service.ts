import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ClientInfo, SessionsService } from './sessions.service';

/** What sign-up, sign-in and refresh hand back. The controller moves
 *  refreshToken into a cookie; the rest is the response body. */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: ReturnType<UsersService['toSafe']>;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly sessions: SessionsService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, client: ClientInfo): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const user = await this.usersService.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });
    return this.startSession(user, client);
  }

  async login(dto: LoginDto, client: ClientInfo): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.startSession(user, client);
  }

  /** New access and refresh tokens, with the user read fresh from the database. */
  async refresh(token: string, client: ClientInfo): Promise<AuthResult> {
    const { userId, token: refreshToken } = await this.sessions.rotate(
      token,
      client,
    );
    const user = await this.usersService.findById(userId).catch(() => null);
    if (!user) {
      await this.sessions.revokeAll(userId);
      throw new UnauthorizedException('Session expired');
    }
    return { ...this.issueAccessToken(user), refreshToken };
  }

  logout(token: string): Promise<void> {
    return this.sessions.revoke(token);
  }

  private async startSession(
    user: UserDocument,
    client: ClientInfo,
  ): Promise<AuthResult> {
    const refreshToken = await this.sessions.create(
      user._id.toString(),
      client,
    );
    return { ...this.issueAccessToken(user), refreshToken };
  }

  private issueAccessToken(user: UserDocument) {
    const safe = this.usersService.toSafe(user);
    const payload = {
      sub: safe.id,
      username: safe.username,
      email: safe.email,
      role: safe.role,
    };
    return { accessToken: this.jwtService.sign(payload), user: safe };
  }
}
