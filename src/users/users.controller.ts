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
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SelfGuard } from '../common/guards/self.guard';
import { UsersService } from './users.service';

const IMAGE_MIME = /image\/(png|jpe?g|webp|gif)/;

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
   * Production-correct path: write file to disk, store only the URL in Mongo.
   * SelfGuard ensures a user can only upload their own avatar.
   */
  @UseGuards(JwtAuthGuard, SelfGuard)
  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!IMAGE_MIME.test(file.mimetype)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
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
    const base = this.config.get<string>('PUBLIC_BASE_URL');
    const avatarUrl = `${base}/uploads/avatars/${file.filename}`;
    const user = await this.usersService.setAvatarUrl(id, avatarUrl);
    return this.usersService.toSafe(user);
  }
}
