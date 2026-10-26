import * as crypto from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';

const PREFIX = 'backup-key:';

@Injectable()
export class BackupKeyService {
  // @Optional() so Nest passes undefined instead of trying to resolve a
  // provider for a plain string, which fails at boot. Tests still construct
  // the service with an explicit secret.
  constructor(
    @Optional()
    private readonly masterSecret = process.env.BACKUP_MASTER_KEY ||
      process.env.INTEGRATIONS_ENCRYPTION_KEY ||
      '',
  ) {
    if (!this.masterSecret && process.env.NODE_ENV === 'production') {
      throw new Error('BACKUP_MASTER_KEY is required in production');
    }
  }

  encryptDataKey(dataKey: Buffer): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    return `${PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`;
  }

  decryptDataKey(value: string): Buffer {
    try {
      if (!value.startsWith(PREFIX)) throw new Error('invalid key');
      const payload = Buffer.from(value.slice(PREFIX.length), 'base64');
      if (payload.length !== 12 + 16 + 32) throw new Error('invalid key');
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.masterKey(),
        payload.subarray(0, 12),
      );
      decipher.setAuthTag(payload.subarray(12, 28));
      return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
    } catch {
      throw new Error('backup key cannot be decrypted');
    }
  }

  private masterKey(): Buffer {
    // The fallback predates the rename; changing it would make existing dev backups unreadable.
    return crypto
      .createHash('sha256')
      .update(this.masterSecret || 'lumio-development-backup-key')
      .digest();
  }
}
