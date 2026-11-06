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
import { basename, join } from 'path';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SelfGuard } from '../common/guards/self.guard';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { AVATAR_LIMIT } from '../common/throttle/limits';
import { AVATAR_TYPES, hasImageSignature, readFileHead } from './avatar-file';

const AVATAR_DIR = './uploads/avatars';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  // Email is shown only to the user themselves and to admins.
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() viewer: AuthUser) {
    const user = await this.usersService.findById(id);
    const isSelfOrAdmin = viewer.userId === id || viewer.role === 'admin';
    return isSelfOrAdmin
      ? this.usersService.toSafe(user)
      : this.usersService.toPublic(user);
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
        destination: AVATAR_DIR,
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
    const previous = (await this.usersService.findById(id)).avatarUrl;
    const user = await this.usersService.setAvatarUrl(
      id,
      `${this.avatarBaseUrl()}${file.filename}`,
    );
    await this.removeStoredAvatar(previous);
    return this.usersService.toSafe(user);
  }

  private avatarBaseUrl(): string {
    return `${this.config.get<string>('PUBLIC_BASE_URL')}/uploads/avatars/`;
  }

  /** Deletes a replaced avatar's file, if it is one of ours. A file that is
   *  already gone is fine. */
  private async removeStoredAvatar(url: string | null): Promise<void> {
    if (!url?.startsWith(this.avatarBaseUrl())) return;
    // basename keeps a crafted URL from reaching outside the folder.
    const name = basename(url.slice(this.avatarBaseUrl().length));
    await unlink(join(AVATAR_DIR, name)).catch(() => undefined);
  }
}
