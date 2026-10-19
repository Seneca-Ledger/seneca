import * as crypto from 'crypto';

const ENCRYPTION_PREFIX = 'enc:';
const ALGORITHM = 'aes-256-gcm';

const getEncryptionKey = () => {
  // No literal fallback. The previous `|| 'lumio'` meant that outside production
  // every integration secret — OAuth refresh tokens, SMTP passwords, per-user AI
  // API keys, TOTP secrets — was encrypted under sha256("lumio"), a key anyone
  // reading this repository knows. Staging deployments stored them in the clear
  // in all but name.
  const resolvedSecret = process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!resolvedSecret) {
    throw new Error(
      'Missing required environment variable: INTEGRATIONS_ENCRYPTION_KEY (or JWT_SECRET)',
    );
  }
  return crypto.createHash('sha256').update(resolvedSecret).digest();
};

export const encryptText = (value: string): string => {
  if (!value) {
    return value;
  }
  if (value.startsWith(ENCRYPTION_PREFIX)) {
    return value;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return `${ENCRYPTION_PREFIX}${payload}`;
};

export const decryptText = (value: string): string => {
  if (!value) {
    return value;
  }
  if (!value.startsWith(ENCRYPTION_PREFIX)) {
    return value;
  }

  try {
    const payload = value.slice(ENCRYPTION_PREFIX.length);
    const data = Buffer.from(payload, 'base64');
    if (data.length < 12 + 16) {
      throw new Error('ciphertext is too short to contain an IV and auth tag');
    }

    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    // Fail closed. Returning the ciphertext as though it were the plaintext
    // handed callers a value that looks usable but is not, so a rotated or
    // mismatched key showed up as a confusing downstream auth failure instead
    // of the key problem it actually is.
    throw new Error(
      `Failed to decrypt stored secret — the encryption key may have changed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};
