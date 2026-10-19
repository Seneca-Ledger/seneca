import * as crypto from 'node:crypto';
import { promisify } from 'node:util';
import * as zlib from 'node:zlib';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const MAGIC = Buffer.from('LVP1');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface EncodedPayload {
  /** sha256 of the plain JSON: the same rows give the same hash, whatever the key. */
  plainSha256: string;
  bytes: Buffer;
}

/**
 * A version's rows as stored: JSON, gzipped, then AES-256-GCM under the
 * version's data key. The hash of the plain JSON is what tells an unchanged
 * day from a changed one; the ciphertext differs every time (fresh IV).
 */
export async function encodePayload(rows: unknown, dataKey: Buffer): Promise<EncodedPayload> {
  const json = Buffer.from(JSON.stringify(rows));
  const plainSha256 = crypto.createHash('sha256').update(json).digest('hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(await gzip(json)), cipher.final()]);
  return { plainSha256, bytes: Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]) };
}

export async function decodePayload<T = unknown>(bytes: Buffer, dataKey: Buffer): Promise<T> {
  if (!bytes.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('not a version payload');
  }
  const ivStart = MAGIC.length;
  const tagStart = ivStart + IV_LENGTH;
  const dataStart = tagStart + TAG_LENGTH;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    dataKey,
    bytes.subarray(ivStart, tagStart),
  );
  decipher.setAuthTag(bytes.subarray(tagStart, dataStart));
  const zipped = Buffer.concat([decipher.update(bytes.subarray(dataStart)), decipher.final()]);
  return JSON.parse((await gunzip(zipped)).toString()) as T;
}
