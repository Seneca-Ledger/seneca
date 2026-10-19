import { BackupArchiveService } from '../../../../src/modules/backups/backup-archive.service';
import AdmZip = require('adm-zip');

describe('BackupArchiveService', () => {
  const service = new BackupArchiveService();

  it('round-trips JSON collections and original documents with a password', async () => {
    const archive = await service.create({
      password: 'correct horse battery staple',
      workspace: { id: 'workspace-1', name: 'Finance' },
      collections: {
        categories: [{ id: 'category-1', name: 'Travel' }],
        transactions: [{ id: 'transaction-1', categoryId: 'category-1', amount: '42.00' }],
      },
      files: [{ path: 'statements/statement-1.csv', contents: Buffer.from('date,amount\n') }],
    });

    const restored = await service.open(archive, 'correct horse battery staple');

    expect(restored.manifest.formatVersion).toBe(1);
    expect(restored.collections.categories).toEqual([{ id: 'category-1', name: 'Travel' }]);
    expect(restored.collections.transactions).toEqual([
      { id: 'transaction-1', categoryId: 'category-1', amount: '42.00' },
    ]);
    expect(restored.files.get('statements/statement-1.csv')).toEqual(Buffer.from('date,amount\n'));
  });

  it('rejects a backup opened with a different password', async () => {
    const archive = await service.create({
      password: 'correct password',
      workspace: { id: 'workspace-1', name: 'Finance' },
      collections: {},
      files: [],
    });

    await expect(service.open(archive, 'wrong password')).rejects.toThrow('password is invalid');
  });

  it('detects a tampered encrypted payload before attempting restore', async () => {
    const archive = await service.create({
      password: 'correct password',
      workspace: { id: 'workspace-1', name: 'Finance' },
      collections: {},
      files: [],
    });
    const container = new AdmZip(archive);
    const manifest = JSON.parse(container.getEntry('manifest.json')?.getData().toString() ?? '{}');
    const { ciphertext } = manifest.encryption.payload;
    // Always a different first character: a ciphertext that already began with 'A' stayed intact.
    manifest.encryption.payload.ciphertext = `${ciphertext[0] === 'A' ? 'B' : 'A'}${ciphertext.slice(1)}`;
    container.updateFile('manifest.json', Buffer.from(JSON.stringify(manifest)));
    const tampered = container.toBuffer();

    await expect(service.open(tampered, 'correct password')).rejects.toThrow('backup is corrupted');
  });

  it('uses persisted encryption material for automatic backups without retaining the password', async () => {
    const encryption = await service.initializeEncryption('correct password');
    const archive = await service.create({
      workspace: { id: 'workspace-1', name: 'Finance' },
      collections: { wallets: [{ id: 'wallet-1', name: 'Cash' }] },
      files: [],
      encryption,
    });

    const restored = await service.open(archive, 'correct password');

    expect(restored.collections.wallets).toEqual([{ id: 'wallet-1', name: 'Cash' }]);
  });

  it('keeps workspace details and document paths out of the clear manifest', async () => {
    const archive = await service.create({
      password: 'correct password',
      workspace: { id: 'workspace-secret', name: 'Private finances' },
      collections: { workspace: [{ id: 'workspace-secret', name: 'Private finances' }] },
      files: [{ path: 'statements/statement-secret/bank-secret.csv', contents: Buffer.from('contents') }],
    });
    const manifest = new AdmZip(archive).getEntry('manifest.json')?.getData().toString() || '';

    expect(manifest).not.toContain('Private finances');
    expect(manifest).not.toContain('bank-secret.csv');
    expect(manifest).not.toContain('workspace-secret');
  });
});
