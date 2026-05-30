//@ts-nocheck

import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UserDocument } from './schemas/user.schema';

// Shared file filter
// Runs before any storage engine touches the file
// Rejects non-image types immediately — file never reaches disk or memory
function imageFileFilter(
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Only JPEG, PNG, WebP and GIF are allowed'), false);
  }
}

// Storage engine for Approach 2 (disk)
// diskStorage writes the file directly to the filesystem
// destination: where to save it
// filename: what to call it — we generate a unique name to avoid collisions
const diskAvatarStorage = diskStorage({
  destination: './uploads/avatars',
  filename: (_req, file, cb) => {
    const uniquePrefix = Date.now();
    const ext = extname(file.originalname);
    const base = file.originalname
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()
      .slice(0, 20);
    cb(null, `${uniquePrefix}-${base}${ext}`);
  },
});

// Storage engine for Approach 1 (Base64 / memory)
// memoryStorage does NOT write to disk at all
// Instead it buffers the file bytes in RAM as file.buffer (a Buffer object)
// We then read file.buffer in the service and convert it to Base64
// Important: only use this for small files — large files will exhaust RAM
const memoryAvatarStorage = memoryStorage();

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Approach 1: Base64
  // POST /api/v1/users/upload/avatar/base64
  // Multer uses memoryStorage — file bytes land in file.buffer
  // Service converts buffer → Base64 string → stores in MongoDB
  //
  // Postman: Body → form-data → key "avatar" (type File) → pick an image
  @Post('upload/avatar/base64')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryAvatarStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 1 * 1024 * 1024, // 1MB max for Base64
        // Keeping this lower than disk because Base64 inflates size by ~33%
        // A 1MB image becomes ~1.37MB string in MongoDB
      },
    }),
  )
  async uploadBase64(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserDocument,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded — use field name "avatar"');
    }

    const updated = await this.usersService.uploadAvatarBase64(
      user._id.toString(),
      file,
    );

    return {
      approach: 'base64',
      message: 'Avatar stored as Base64 string in MongoDB',
      // Show a preview of the string — first 80 chars so you can see the format
      // The full string is in MongoDB (could be 100,000+ chars for a real image)
      preview: updated.avatarBase64?.substring(0, 80) + '...',
      howToUse: 'Put the full avatarBase64 value directly in <img src="...">',
      // To see it: GET /api/v1/users/:id and use avatarBase64 in an img tag
    };
  }

  // Approach 2: Disk
  // POST /api/v1/users/upload/avatar/disk
  // Multer uses diskStorage — file is written to ./uploads/avatars/
  // Service gets file.filename, builds the URL, stores it in MongoDB
  //
  // Postman: Body → form-data → key "avatar" (type File) → pick an image
  @Post('upload/avatar/disk')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskAvatarStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB max for disk
      },
    }),
  )
  async uploadDisk(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserDocument,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded — use field name "avatar"');
    }

    const updated = await this.usersService.uploadAvatarDisk(
      user._id.toString(),
      file,
    );

    return {
      approach: 'disk',
      message: 'Avatar saved to disk, path stored in MongoDB',
      avatarUrl: updated.avatarUrl,
      fullUrl: `http://localhost:3000${updated.avatarUrl}`,
      howToUse: 'Use fullUrl directly in <img src="..."> — Express serves the file',
    };
  }

  // GET /api/v1/users/:id — view full profile with both avatar fields
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }
}