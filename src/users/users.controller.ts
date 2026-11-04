import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SelfGuard } from '../common/guards/self.guard';
import { UsersService } from './users.service';
import { AVATAR_LIMIT } from '../common/throttle/limits';
import { AVATAR_TYPES, hasImageSignature, readFileHead } from './avatar-file';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return this.usersService.toSafe(user);
  }

  /**
   * Writes the file to disk and stores only its URL in Mongo. SelfGuard limits
   * a user to their own avatar. The declared type must be on the allowlist, the
   * stored extension comes from that type (never the client's filename), and
   * the file's first bytes must match it, so an HTML page cannot be uploaded
   * under an image label.
   */
  @Throttle(AVATAR_LIMIT)
  @UseGuards(JwtAuthGuard, SelfGuard)
  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${AVATAR_TYPES[file.mimetype]}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!AVATAR_TYPES[file.mimetype]) {
          return cb(
            new BadRequestException('Only PNG, JPEG, GIF or WebP images'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const head = await readFileHead(file.path);
    if (!hasImageSignature(head, file.mimetype)) {
      await unlink(file.path);
      throw new BadRequestException('File content is not a valid image');
    }
    const base = this.config.get<string>('PUBLIC_BASE_URL');
    const avatarUrl = `${base}/uploads/avatars/${file.filename}`;
    const user = await this.usersService.setAvatarUrl(id, avatarUrl);
    return this.usersService.toSafe(user);
  }
}
