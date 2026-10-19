import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import { resolveUploadsDir } from '../common/utils/uploads.util';

// Allow overriding upload dir for production (e.g. mounted volume)
const uploadsRoot = resolveUploadsDir();

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'text/csv': '.csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/tiff': '.tiff',
  'image/bmp': '.bmp',
  'image/webp': '.webp',
  'application/x-ofx': '.ofx',
  'application/qif': '.qif',
  'application/xml': '.xml',
  'text/xml': '.xml',
  'text/plain': '.txt',
};

export const resolveSafeUploadExtension = (file: {
  mimetype?: string | null;
  originalname?: string | null;
}): string => EXTENSION_BY_MIME[file.mimetype || ''] || '.bin';

export const multerConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRoot),
    filename: (_req, file, cb) => {
      const uniqueName = `${randomUUID()}${resolveSafeUploadExtension(file)}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
};
