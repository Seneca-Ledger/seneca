import { randomBytes, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { VersionBlobStore } from '../../../../src/modules/versions/version-blob-store';
import { decodePayload, encodePayload } from '../../../../src/modules/versions/version-payload';

describe('VersionBlobStore', () => {
  let root: string;
  let store: VersionBlobStore;
  const workspaceId = randomUUID();

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'versions-'));
    store = new VersionBlobStore(root);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const writeSource = (contents: string) => {
    const file = path.join(root, `source-${randomUUID()}`);
    fs.writeFileSync(file, contents);
    return file;
  };

  it('stores a document once, however many versions hold it', async () => {
    const first = await store.putFile(workspaceId, writeSource('bank statement'));
    const second = await store.putFile(workspaceId, writeSource('bank statement'));

    expect(second).toBe(first);
    const blobs = fs.readdirSync(path.join(root, workspaceId, 'blobs', first.slice(0, 2)));
    expect(blobs).toEqual([first]);
    expect(fs.readFileSync(store.blobPath(workspaceId, first), 'utf8')).toBe('bank statement');
  });

  it('keeps stored files read only', async () => {
    const sha = await store.putBytes(workspaceId, Buffer.from('invoice pdf'));
    expect(fs.statSync(store.blobPath(workspaceId, sha)).mode & 0o222).toBe(0);
  });

  it('puts a stored file in place as a hard link, not a copy', async () => {
    const sha = await store.putBytes(workspaceId, Buffer.from('receipt'));
    const target = path.join(root, 'uploads', 'versions', 'receipt.jpg');
    await store.linkInto(workspaceId, sha, target);

    expect(fs.readFileSync(target, 'utf8')).toBe('receipt');
    expect(fs.statSync(target).ino).toBe(fs.statSync(store.blobPath(workspaceId, sha)).ino);
  });

  it('refuses paths that would leave its own folder', () => {
    expect(() => store.blobPath(workspaceId, '../../etc/passwd')).toThrow('invalid blob hash');
    expect(() => store.blobPath('../other', 'a'.repeat(64))).toThrow('invalid workspace id');
  });

  it('removes only files no version refers to, and only once they are old enough', async () => {
    const kept = await store.putBytes(workspaceId, Buffer.from('kept'));
    const stale = await store.putBytes(workspaceId, Buffer.from('stale'));
    const fresh = await store.putBytes(workspaceId, Buffer.from('fresh'));
    const old = (Date.now() - 2 * 60 * 60 * 1000) / 1000;
    for (const sha of [kept, stale]) fs.utimesSync(store.blobPath(workspaceId, sha), old, old);

    const removed = await store.collectGarbage(workspaceId, new Set([kept]));

    expect(removed).toBe(1);
    expect(fs.existsSync(store.blobPath(workspaceId, kept))).toBe(true);
    expect(fs.existsSync(store.blobPath(workspaceId, stale))).toBe(false);
    expect(fs.existsSync(store.blobPath(workspaceId, fresh))).toBe(true);
  });
});

describe('version payload', () => {
  const key = randomBytes(32);
  const rows = { transactions: [{ id: 't1', amount: '42.50' }], budgets: [] };

  it('round-trips the rows under the key', async () => {
    const encoded = await encodePayload(rows, key);
    expect(await decodePayload(encoded.bytes, key)).toEqual(rows);
  });

  it('hashes the plain rows, so an unchanged day is recognised however it was encrypted', async () => {
    const first = await encodePayload(rows, key);
    const second = await encodePayload(rows, randomBytes(32));
    expect(second.plainSha256).toBe(first.plainSha256);
    expect(second.bytes.equals(first.bytes)).toBe(false);
    const changed = await encodePayload({ ...rows, budgets: [{ id: 'b1' }] }, key);
    expect(changed.plainSha256).not.toBe(first.plainSha256);
  });

  it('refuses another key and a tampered payload', async () => {
    const encoded = await encodePayload(rows, key);
    await expect(decodePayload(encoded.bytes, randomBytes(32))).rejects.toThrow();
    const tampered = Buffer.from(encoded.bytes);
    tampered[tampered.length - 1] ^= 0xff;
    await expect(decodePayload(tampered, key)).rejects.toThrow();
  });
});
