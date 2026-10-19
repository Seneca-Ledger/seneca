import * as path from 'path';

const SAFE_CHARS_REGEX = /[^a-zA-Z0-9._-]/g;

// The stored extension is derived from the allowlisted MIME type and never
// from the client-supplied filename. Taking it from `originalname` let a file
// called "payload.html" be stored as .html and later served from
// GET /users/avatars/:fileName with a text/html Content-Type — same-origin
// stored XSS against a frontend that holds auth tokens.
const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function isAllowedAvatarMime(mimetype?: string | null): boolean {
  return Boolean(mimetype && AVATAR_EXTENSION_BY_MIME[mimetype]);
}

export function resolveAvatarContentType(fileName: string): string | null {
  const extension = path.extname(fileName).toLowerCase();
  const match = Object.entries(AVATAR_EXTENSION_BY_MIME).find(([, ext]) => ext === extension);
  return match ? match[0] : null;
}

export function sanitizeAvatarFilename(
  originalName: string,
  mimetype: string,
  timestamp = Date.now(),
): string {
  const extension = AVATAR_EXTENSION_BY_MIME[mimetype];
  if (!extension) {
    throw new Error(`Unsupported avatar type: ${mimetype}`);
  }

  const trimmed = (originalName || '').trim();
  const baseName = path.basename(trimmed || 'avatar');
  const parsed = path.parse(baseName);

  const safeStem = (parsed.name || 'avatar').replace(SAFE_CHARS_REGEX, '_').replace(/_+/g, '_');
  const normalizedStem = safeStem.replace(/^[_-]+|[_-]+$/g, '') || 'avatar';

  return `${timestamp}-${normalizedStem}${extension}`;
}
