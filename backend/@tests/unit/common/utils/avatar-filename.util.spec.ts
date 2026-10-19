import {
  isAllowedAvatarMime,
  resolveAvatarContentType,
  sanitizeAvatarFilename,
} from '@/common/utils/avatar-filename.util';

describe('sanitizeAvatarFilename', () => {
  it('replaces spaces and unsafe characters', () => {
    expect(sanitizeAvatarFilename('photo 2026-01-02 16.36.23.jpeg', 'image/jpeg', 1770)).toBe(
      '1770-photo_2026-01-02_16.36.23.jpg',
    );
  });

  it('falls back to extension-safe default name', () => {
    expect(sanitizeAvatarFilename('@@@.png', 'image/png', 7)).toBe('7-avatar.png');
  });

  it('keeps only basename and strips traversal', () => {
    expect(sanitizeAvatarFilename('../../my avatar.jpg', 'image/jpeg', 9)).toBe('9-my_avatar.jpg');
  });

  it('derives the extension from the MIME type, not the original name', () => {
    expect(sanitizeAvatarFilename('payload.html', 'image/png', 42)).toBe('42-payload.png');
    expect(sanitizeAvatarFilename('payload.svg', 'image/webp', 42)).toBe('42-payload.webp');
  });

  it('rejects a MIME type outside the image allowlist', () => {
    expect(() => sanitizeAvatarFilename('x.png', 'text/html', 1)).toThrow('Unsupported avatar type');
    expect(() => sanitizeAvatarFilename('x.png', 'image/svg+xml', 1)).toThrow(
      'Unsupported avatar type',
    );
  });
});

describe('isAllowedAvatarMime', () => {
  it('accepts only the four raster image types', () => {
    expect(isAllowedAvatarMime('image/png')).toBe(true);
    expect(isAllowedAvatarMime('image/gif')).toBe(true);
    expect(isAllowedAvatarMime('image/svg+xml')).toBe(false);
    expect(isAllowedAvatarMime('text/html')).toBe(false);
    expect(isAllowedAvatarMime(undefined)).toBe(false);
  });
});

describe('resolveAvatarContentType', () => {
  it('maps a stored filename back to its image type', () => {
    expect(resolveAvatarContentType('1770-photo.jpg')).toBe('image/jpeg');
    expect(resolveAvatarContentType('1770-photo.WEBP')).toBe('image/webp');
  });

  it('returns null for anything not in the allowlist', () => {
    expect(resolveAvatarContentType('legacy.html')).toBeNull();
    expect(resolveAvatarContentType('legacy')).toBeNull();
  });
});
