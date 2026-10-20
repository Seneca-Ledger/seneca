import * as crypto from 'node:crypto';
import { promisify } from 'node:util';

import AdmZip = require('adm-zip');

const scrypt = promisify(crypto.scrypt);
const ARCHIVE_FORMAT_VERSION = 1;
/** Archives made before the rename to Seneca say 'lumio-backup'; they restore the same way. */
const ARCHIVE_FORMATS = ['seneca-backup', 'lumio-backup'] as const;
export const BACKUP_FILE_EXTENSION = '.seneca-backup';
export const isBackupFileName = (name: string): boolean =>
  name.endsWith(BACKUP_FILE_EXTENSION) || name.endsWith('.lumio-backup');
const DATA_KEY_LENGTH = 32;

/**
 * What opening an archive may unpack. adm-zip inflates an entry no further
 * than the size its header declares, so checking the declared sizes first
 * bounds memory: an upload is capped at 200 MB, and its one manifest carries
 * the payload as base64 text, so even the largest real backup stays well inside.
 */
const MAX_MANIFEST_BYTES = 300 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 1024 * 1024 * 1024;
const MAX_PAYLOAD_ENTRIES = 100_000;
const TOO_LARGE = 'backup is too large';

type ArchiveInput = {
  password?: string;
  workspace: { id: string; name: string };
  collections: Record<string, unknown[]>;
  files: Array<{ path: string; contents: Buffer }>;
  encryption?: BackupEncryptionMaterial;
};

type EncryptionEnvelope = {
  iv: string;
  tag: string;
  ciphertext: string;
};

export type BackupPasswordEnvelope = {
  kdf: { algorithm: 'scrypt'; salt: string; keyLength: number };
  wrappedDataKey: EncryptionEnvelope;
};

export type BackupEncryptionMaterial = {
  dataKey: Buffer;
  passwordEnvelope: BackupPasswordEnvelope;
};

export type BackupManifest = {
  format: (typeof ARCHIVE_FORMATS)[number];
  formatVersion: number;
  createdAt: string;
  collections: Record<string, number>;
  files: Array<{ size: number; sha256: string }>;
  payloadSha256: string;
  encryption: {
    algorithm: 'aes-256-gcm';
    kdf: BackupPasswordEnvelope['kdf'];
    wrappedDataKey: BackupPasswordEnvelope['wrappedDataKey'];
    payload: EncryptionEnvelope;
  };
};

export type OpenedBackup = {
  manifest: BackupManifest;
  collections: Record<string, unknown[]>;
  files: Map<string, Buffer>;
};

export class BackupArchiveService {
  async initializeEncryption(password: string): Promise<BackupEncryptionMaterial> {
    this.assertPassword(password);
    const dataKey = crypto.randomBytes(DATA_KEY_LENGTH);
    const salt = crypto.randomBytes(16);
    const passwordKey = await this.derivePasswordKey(password, salt);
    return {
      dataKey,
      passwordEnvelope: {
        kdf: { algorithm: 'scrypt', salt: salt.toString('base64'), keyLength: DATA_KEY_LENGTH },
        wrappedDataKey: this.encrypt(dataKey, passwordKey),
      },
    };
  }

  async create(input: ArchiveInput): Promise<Buffer> {
    const payload = new AdmZip();
    const collectionCounts: Record<string, number> = {};
    for (const [name, records] of Object.entries(input.collections)) {
      collectionCounts[name] = records.length;
      payload.addFile(
        `data/${this.safePathSegment(name)}.json`,
        Buffer.from(JSON.stringify(records)),
      );
    }

    const files = input.files.map(file => ({
      size: file.contents.length,
      sha256: this.sha256(file.contents),
    }));
    for (const file of input.files) {
      payload.addFile(`files/${this.safeFilePath(file.path)}`, file.contents);
    }

    const encryption = input.encryption || (await this.initializeEncryption(input.password || ''));
    const encryptedPayload = this.encrypt(payload.toBuffer(), encryption.dataKey);
    const manifest: BackupManifest = {
      format: 'seneca-backup',
      formatVersion: ARCHIVE_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      collections: collectionCounts,
      files,
      payloadSha256: this.sha256(Buffer.from(encryptedPayload.ciphertext, 'base64')),
      encryption: {
        algorithm: 'aes-256-gcm',
        kdf: encryption.passwordEnvelope.kdf,
        wrappedDataKey: encryption.passwordEnvelope.wrappedDataKey,
        payload: encryptedPayload,
      },
    };

    const container = new AdmZip();
    container.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
    return container.toBuffer();
  }

  async open(archive: Buffer, password: string): Promise<OpenedBackup> {
    this.assertPassword(password);
    try {
      const container = new AdmZip(archive);
      const manifestEntry = container.getEntry('manifest.json');
      if (!manifestEntry) {
        throw new Error('missing manifest');
      }
      this.assertUnpackedSize([manifestEntry], MAX_MANIFEST_BYTES, 1);
      const manifest = JSON.parse(manifestEntry.getData().toString('utf8')) as BackupManifest;
      this.validateManifest(manifest);

      const payloadCiphertext = Buffer.from(manifest.encryption.payload.ciphertext, 'base64');
      if (this.sha256(payloadCiphertext) !== manifest.payloadSha256) {
        throw new Error('payload checksum mismatch');
      }

      const salt = Buffer.from(manifest.encryption.kdf.salt, 'base64');
      const passwordKey = await this.derivePasswordKey(password, salt);
      const dataKey = this.decrypt(
        manifest.encryption.wrappedDataKey,
        passwordKey,
        'password is invalid',
      );
      const payload = this.decrypt(manifest.encryption.payload, dataKey, 'backup is corrupted');
      const inner = new AdmZip(payload);
      this.assertUnpackedSize(inner.getEntries(), MAX_PAYLOAD_BYTES, MAX_PAYLOAD_ENTRIES);
      const collections: Record<string, unknown[]> = {};
      const files = new Map<string, Buffer>();

      for (const entry of inner.getEntries()) {
        if (entry.isDirectory) continue;
        if (entry.entryName.startsWith('data/') && entry.entryName.endsWith('.json')) {
          const name = entry.entryName.slice('data/'.length, -'.json'.length);
          const records = JSON.parse(entry.getData().toString('utf8'));
          if (!Array.isArray(records)) {
            throw new Error('invalid collection');
          }
          collections[name] = records;
          continue;
        }
        if (entry.entryName.startsWith('files/')) {
          files.set(entry.entryName.slice('files/'.length), entry.getData());
        }
      }

      this.verifyContents(manifest, collections, files);
      return { manifest, collections, files };
    } catch (error) {
      if (
        error instanceof Error &&
        ['password is invalid', 'backup is corrupted', TOO_LARGE].includes(error.message)
      ) {
        throw error;
      }
      throw new Error('backup is corrupted');
    }
  }

  /** Refuses entries that would unpack to more than `maxBytes` together, or too many of them. */
  private assertUnpackedSize(entries: AdmZip.IZipEntry[], maxBytes: number, maxEntries: number) {
    const declared = entries.reduce((total, entry) => total + entry.header.size, 0);
    if (entries.length > maxEntries || declared > maxBytes) {
      throw new Error(TOO_LARGE);
    }
  }

  private async derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
    return (await scrypt(password, salt, DATA_KEY_LENGTH)) as Buffer;
  }

  private encrypt(plaintext: Buffer, key: Buffer): EncryptionEnvelope {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  private decrypt(envelope: EncryptionEnvelope, key: Buffer, message: string): Buffer {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(envelope.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]);
    } catch {
      throw new Error(message);
    }
  }

  private validateManifest(manifest: BackupManifest): void {
    if (
      !ARCHIVE_FORMATS.includes(manifest?.format) ||
      manifest.formatVersion !== ARCHIVE_FORMAT_VERSION ||
      manifest.encryption?.algorithm !== 'aes-256-gcm' ||
      manifest.encryption.kdf?.algorithm !== 'scrypt' ||
      !manifest.encryption.wrappedDataKey ||
      !manifest.encryption.payload
    ) {
      throw new Error('unsupported manifest');
    }
  }

  private verifyContents(
    manifest: BackupManifest,
    collections: Record<string, unknown[]>,
    files: Map<string, Buffer>,
  ): void {
    for (const [name, count] of Object.entries(manifest.collections)) {
      if (collections[name]?.length !== count) {
        throw new Error('collection count mismatch');
      }
    }
    const expectedFiles = manifest.files.map(file => `${file.sha256}:${file.size}`).sort();
    const actualFiles = [...files.values()]
      .map(file => `${this.sha256(file)}:${file.length}`)
      .sort();
    if (
      expectedFiles.length !== actualFiles.length ||
      expectedFiles.some((file, index) => file !== actualFiles[index])
    ) {
      throw new Error('file checksum mismatch');
    }
  }

  private safePathSegment(value: string): string {
    if (!/^[a-z0-9_-]+$/i.test(value)) {
      throw new Error('invalid collection name');
    }
    return value;
  }

  private safeFilePath(value: string): string {
    const normalized = value.replace(/\\/g, '/');
    if (
      !normalized ||
      normalized.startsWith('/') ||
      normalized.split('/').some(part => part === '..' || !part)
    ) {
      throw new Error('invalid backup file path');
    }
    return normalized;
  }

  private sha256(value: Buffer | string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private assertPassword(password: string): void {
    if (!password) {
      throw new Error('backup password is required');
    }
  }
}
