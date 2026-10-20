import { Stream } from 'node:stream';
import { StreamableFile } from '@nestjs/common';

/**
 * Never leaves the server, whatever the answer: where a file sits and what it
 * holds or hashes to, and credentials with what versions them.
 */
export const SERVER_ONLY_KEYS: ReadonlySet<string> = new Set([
  'filePath',
  'fileHash',
  'fileData',
  'storedFileName',
  'attachmentPaths',
  'passwordHash',
  'tokenVersion',
  'twoFactorSecret',
  'twoFactorRecoveryCodes',
  'encryptedSecrets',
]);

/** A person's own account details: theirs to read in their profile, nobody else's. */
export const ACCOUNT_KEYS: ReadonlySet<string> = new Set([
  ...SERVER_ONLY_KEYS,
  'telegramId',
  'telegramChatId',
  'lastLogin',
]);

const isPassThrough = (value: object): boolean =>
  value instanceof Date ||
  value instanceof StreamableFile ||
  // The Express response a `@Res()` handler returns, or a stream: not data, and full of cycles.
  value instanceof Stream ||
  Buffer.isBuffer(value) ||
  ArrayBuffer.isView(value) ||
  // Something that serializes itself (a money or date library) knows its own shape.
  ('toJSON' in value && typeof value.toJSON === 'function');

/** `value` without `keys` at any depth. Returns a copy; the input is left as it was. */
export function withoutKeys(value: unknown, keys: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map(item => withoutKeys(item, keys));
  if (typeof value !== 'object' || value === null || isPassThrough(value)) return value;
  return recordWithoutKeys(value, keys);
}

/** The same for a record, which stays a record. */
export function recordWithoutKeys(
  value: object,
  keys: ReadonlySet<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !keys.has(key))
      .map(([key, item]) => [key, withoutKeys(item, keys)]),
  );
}
