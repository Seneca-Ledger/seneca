import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { appError } from '../errors/app-error';
import { resolveUploadsDir } from './uploads.util';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Interchange formats; validateFile admits them only when the content agrees.
  '.ofx': 'application/x-ofx',
  '.qfx': 'application/x-ofx',
  '.qif': 'application/qif',
  '.xml': 'application/xml',
  '.sta': 'text/plain',
  '.mt940': 'text/plain',
};

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * A file sent as base64 (an MCP tool argument), written to the uploads
 * directory and shaped like a multer upload, so the upload services take it
 * as they take a multipart file. The MIME type follows the extension; the
 * caller still validates the content.
 */
export async function writeBase64Upload(
  base64: string,
  fileName: string,
  maxBytes: number,
): Promise<Express.Multer.File> {
  if (!BASE64.test(base64)) {
    throw new BadRequestException(appError('FILE_BASE64_INVALID'));
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) {
    throw new BadRequestException(appError('FILE_EMPTY'));
  }
  if (buffer.length > maxBytes) {
    throw new BadRequestException(
      appError('FILE_TOO_LARGE_MB', { limit: Math.floor(maxBytes / 1024 / 1024) }),
    );
  }
  const extension = extname(fileName).toLowerCase();
  const uploadsDir = resolveUploadsDir();
  const storedName = `${randomUUID()}${extension || '.bin'}`;
  const path = join(uploadsDir, storedName);
  await writeFile(path, buffer);
  return {
    fieldname: 'file',
    originalname: fileName,
    encoding: '7bit',
    mimetype: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream',
    destination: uploadsDir,
    filename: storedName,
    path,
    size: buffer.length,
  } as Express.Multer.File;
}
