import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import {
  isAllowedAvatarMime,
  resolveAvatarContentType,
  sanitizeAvatarFilename,
} from '../../common/utils/avatar-filename.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';

/** Sends an uploaded avatar by its file name; only the base name is used. */
export function sendAvatarFile(res: Response, fileName: string) {
  const uploadsDir = resolveUploadsDir();
  const safeFileName = path.basename(fileName);
  const filePath = path.join(uploadsDir, 'user-avatars', safeFileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Avatar not found');
  }

  // Pin the Content-Type to the image type the extension maps to instead of
  // letting sendFile infer it: an inferred text/html here would execute on
  // this origin. Unknown extensions predate the allowlist — serve them
  // as an opaque download rather than guessing a type for them.
  const contentType = resolveAvatarContentType(safeFileName);

  return res.sendFile(filePath, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': contentType ?? 'application/octet-stream',
      ...(contentType ? {} : { 'Content-Disposition': 'attachment' }),
    },
  });
}

/** Where `POST /users/me/avatar` stores the upload, and which images it takes. */
export const avatarUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const uploadsDir = resolveUploadsDir();
      const targetDir = path.join(uploadsDir, 'user-avatars');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
      try {
        cb(null, sanitizeAvatarFilename(file.originalname, file.mimetype));
      } catch {
        // Unreachable while fileFilter runs first, but the filename callback
        // must not surface an unsupported type as a 500.
        cb(new BadRequestException('Unsupported avatar type'), '');
      }
    },
  }),
  fileFilter: (_req, file, cb) => {
    // Allowlist, not `startsWith('image/')`: the declared type decides the
    // stored extension, so anything outside this set must be rejected here.
    if (!isAllowedAvatarMime(file.mimetype)) {
      return cb(new BadRequestException('Only JPEG, PNG, WebP and GIF images are allowed'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 2_000_000 },
};
