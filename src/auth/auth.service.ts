import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const user = await this.usersService.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });
    return this.issueToken(
      user._id.toString(),
      user.username,
      user.email,
      user.role,
    );
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueToken(
      user._id.toString(),
      user.username,
      user.email,
      user.role,
    );
  }

  private issueToken(
    userId: string,
    username: string,
    email: string,
    role: string,
  ) {
    const payload = { sub: userId, username, email, role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: userId, username, email, role },
    };
  }
}
