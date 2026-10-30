import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { appError } from '../errors/app-error';

const CUSTOM_ICON_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function isAllowedCustomIconMime(mimetype?: string | null): boolean {
  return Boolean(mimetype && CUSTOM_ICON_EXTENSIONS[mimetype]);
}

export function sanitizePublicUploadFilename(file: { mimetype?: string | null }): string {
  const extension = CUSTOM_ICON_EXTENSIONS[file.mimetype || ''];
  if (!extension) {
    throw new BadRequestException(appError('FILE_PUBLIC_UPLOAD_TYPE_UNSUPPORTED'));
  }
  return `${randomUUID()}${extension}`;
}
