import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ access_token: string; user: object }> {

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Pass the hash to UsersService — the raw password is now out of scope
    // It will be garbage collected. It never touches MongoDB.
    const user = await this.usersService.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });

    // Issue a token immediately on register so the user is logged in right away
    const token = this.signToken(user);

    return {
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto): Promise<{ access_token: string; user: object }> {
    // Step 1 — find the user in MongoDB by email
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      // Intentionally vague — don't tell the caller whether
      // the email exists or the password is wrong. Both return the same error.
      // This prevents user enumeration attacks.
      throw new UnauthorizedException('Invalid credentials');
    }

    // Step 2 — compare the incoming password against the stored hash
    // bcrypt.compare() hashes dto.password with the same salt that's embedded
    // inside user.passwordHash and checks if they match
    // This is the ONLY correct way to verify a bcrypt password
    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Step 3 — sign and return the JWT
    const token = this.signToken(user);

    return {
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  // Called by JwtStrategy.validate() on every protected request
  // At this point the JWT signature is already verified — we just
  // need to confirm the user still exists in MongoDB (not deleted since token was issued)
  async validateUser(userId: string): Promise<UserDocument> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return user;
  }

  // JWT payload — what gets encoded inside the token
  // Keep this minimal: just enough to identify the user and their role
  // The full user object is NOT stored in the token — tokens are sent
  // with every request so keeping them small matters
  private signToken(user: UserDocument): string {
    const payload = {
      sub: user._id.toString(), // sub = subject, standard JWT claim for user ID
      email: user.email,
      role: user.role,
      username: user.username,
    };

    return this.jwtService.sign(payload);
  }

  // Strip sensitive fields before sending user data in the response
  // passwordHash must NEVER appear in any API response
  private sanitizeUser(user: UserDocument): object {
    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }
}