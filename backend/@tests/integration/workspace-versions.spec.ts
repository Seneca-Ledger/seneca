/**
 * Integration test — taking and keeping workspace versions, against a real Postgres.
 *
 * A version is the workspace's rows (encrypted) and its documents, stored once
 * by hash. A night with no changes must cost a row and nothing else; a change
 * stores new rows but shares the documents; retention lets old versions go and
 * then the stored files no version needs.
 */
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ForbiddenException } from '@nestjs/common';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

import { resolveUploadsDir } from '../../src/common/utils/uploads.util';
import * as entityIndex from '../../src/entities';
import { User, Workspace, WorkspaceMember, WorkspaceVersion } from '../../src/entities';
import { BackupArchiveService } from '../../src/modules/backups/backup-archive.service';
import { BackupDataService } from '../../src/modules/backups/backup-data.service';
import { BackupKeyService } from '../../src/modules/backups/backup-key.service';
import { BackupRestoreService } from '../../src/modules/backups/backup-restore.service';
import { VersionBlobStore } from '../../src/modules/versions/version-blob-store';
import { VersionSchedulerService } from '../../src/modules/versions/version-scheduler.service';
import { decodePayload } from '../../src/modules/versions/version-payload';
import {
  type VersionPayload,
  VersionSnapshotService,
} from '../../src/modules/versions/version-snapshot.service';
import { VersionsService } from '../../src/modules/versions/versions.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_workspace_versions_${process.pid}`;

function scratchUrl(database: string): string {
  const url = new URL(BASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

const ENTITIES = Object.values(entityIndex).filter(
  (value): value is Function => typeof value === 'function',
);

/** Loaded by hand: TypeORM's glob loader bypasses Jest's transform. */
function loadMigrations(): Function[] {
  const dir = path.resolve(__dirname, '../../src/migrations');
  return fs
    .readdirSync(dir)
    .filter(file => file.endsWith('.ts'))
    .sort()
    .flatMap(file =>
      Object.values(require(path.join(dir, file))).filter(
        (value): value is Function => typeof value === 'function',
      ),
    );
}

const filesIn = (directory: string): string[] =>
  fs.existsSync(directory)
    ? fs.readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
    : [];

describe('workspace versions are taken and kept (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let snapshots: VersionSnapshotService;
  let versions: VersionsService;
  let keyService: BackupKeyService;
  let store: VersionBlobStore;
  let versionsRoot: string;
  let workspace: Workspace;
  let owner: User;
  const tempFiles: string[] = [];

  const sql = (text: string, params: unknown[] = []) => dataSource.query(text, params);
  const blobsDir = () => path.join(versionsRoot, workspace.id, 'blobs');

  beforeAll(async () => {
    versionsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'versions-it-'));
    process.env.VERSIONS_ROOT = versionsRoot;

    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    await admin.end();

    dataSource = new DataSource({
      type: 'postgres',
      url: scratchUrl(SCRATCH_DB),
      entities: ENTITIES,
      migrations: loadMigrations(),
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    const collector = new BackupDataService(dataSource, {
      getStatementFileStream: async (statement: { filePath: string; fileName: string }) => ({
        stream: fs.createReadStream(statement.filePath),
        fileName: statement.fileName,
      }),
    } as never);
    keyService = new BackupKeyService('integration-test-master-key');
    store = new VersionBlobStore(versionsRoot);
    snapshots = new VersionSnapshotService(
      dataSource,
      dataSource.getRepository(WorkspaceVersion),
      collector,
      keyService,
    );
    versions = new VersionsService(
      dataSource.getRepository(WorkspaceVersion),
      dataSource.getRepository(Workspace),
      dataSource.getRepository(User),
      dataSource.getRepository(WorkspaceMember),
      snapshots,
      new BackupRestoreService(
        dataSource,
        dataSource.getRepository(Workspace),
        dataSource.getRepository(WorkspaceMember),
        new BackupArchiveService(),
      ),
      keyService,
    );

    const [{ id: workspaceId }] = await sql(
      "INSERT INTO workspaces (name, currency) VALUES ('Keller Design', 'EUR') RETURNING id",
    );
    owner = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: `versions-${randomUUID()}@example.com`,
        passwordHash: 'x',
        name: 'Owner',
        workspaceId,
        timeZone: 'Europe/Berlin',
      }),
    );
    await sql('UPDATE workspaces SET owner_id = $1 WHERE id = $2', [owner.id, workspaceId]);
    workspace = await dataSource.getRepository(Workspace).findOneByOrFail({ id: workspaceId });

    const statementFile = path.join(resolveUploadsDir(), `versions-it-${randomUUID()}.pdf`);
    fs.mkdirSync(path.dirname(statementFile), { recursive: true });
    fs.writeFileSync(statementFile, '%PDF-1.4 bank statement');
    tempFiles.push(statementFile);
    const [{ id: statementId }] = await sql(
      `INSERT INTO statements (workspace_id, user_id, file_name, file_path, file_type, file_size, file_hash, bank_name, currency, status)
       VALUES ($1, $2, 'bank.pdf', $3, 'pdf', 24, $4, 'other', 'EUR', 'completed') RETURNING id`,
      [
        workspaceId,
        owner.id,
        statementFile,
        createHash('sha256').update('%PDF-1.4 bank statement').digest('hex'),
      ],
    );
    await sql(
      `INSERT INTO transactions (workspace_id, statement_id, transaction_date, counterparty_name, payment_purpose, currency, transaction_type, amount, debit, is_verified)
       VALUES ($1, $2, '2026-10-02', 'Lidl', 'Lidl', 'EUR', 'expense', 42.5, 42.5, true)`,
      [workspaceId, statementId],
    );
  });

  afterAll(async () => {
    for (const file of tempFiles) fs.rmSync(file, { force: true });
    fs.rmSync(versionsRoot, { recursive: true, force: true });
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  const payloadOf = async (version: WorkspaceVersion): Promise<VersionPayload> => {
    const withKey = await dataSource
      .getRepository(WorkspaceVersion)
      .createQueryBuilder('version')
      .addSelect('version.wrappedDataKey')
      .where('version.id = :id', { id: version.id })
      .getOneOrFail();
    const bytes = await store.readBytes(workspace.id, withKey.payloadBlob as string);
    return decodePayload(bytes, keyService.decryptDataKey(withKey.wrappedDataKey as string));
  };

  it('takes a version: the rows encrypted, the documents stored by hash', async () => {
    const version = await versions.takeNow(workspace.id, owner.id);

    expect(version.status).toBe('ready');
    expect(version.rowCounts.transactions).toBe(1);
    expect(version.rowCounts.statements).toBe(1);
    const payload = await payloadOf(version);
    expect(payload.collections.transactions).toHaveLength(1);
    const [statementPath] = Object.keys(payload.files);
    const sha = payload.files[statementPath];
    expect(fs.readFileSync(store.blobPath(workspace.id, sha), 'utf8')).toBe('%PDF-1.4 bank statement');
    expect(version.fileRefs).toEqual(expect.arrayContaining([version.payloadBlob, sha]));
  });

  it('costs nothing new on a day without changes', async () => {
    const before = filesIn(blobsDir()).sort();
    const [previous] = await versions.list(workspace.id, owner.id);
    const again = await versions.takeNow(workspace.id, owner.id);

    expect(again.id).not.toBe(previous.id);
    expect(again.payloadSha256).toBe(previous.payloadSha256);
    expect(again.payloadBlob).toBe(previous.payloadBlob);
    expect(filesIn(blobsDir()).sort()).toEqual(before);
  });

  it('stores new rows after a change, and still shares the documents', async () => {
    const [previous] = await versions.list(workspace.id, owner.id);
    await sql("UPDATE transactions SET counterparty_name = 'Lidl Berlin' WHERE workspace_id = $1", [
      workspace.id,
    ]);
    const changed = await versions.takeNow(workspace.id, owner.id);

    expect(changed.payloadSha256).not.toBe(previous.payloadSha256);
    expect(changed.payloadBlob).not.toBe(previous.payloadBlob);
    const documents = (version: WorkspaceVersion) =>
      version.fileRefs.filter(ref => ref !== version.payloadBlob);
    expect(documents(changed)).toEqual(documents(previous));
    const payload = await payloadOf(changed);
    expect(
      (payload.collections.transactions[0] as { counterpartyName: string }).counterpartyName,
    ).toBe('Lidl Berlin');
  });

  it('lets old versions go, then the stored files no version needs', async () => {
    const backdate = (id: string, days: number) =>
      sql(`UPDATE workspace_versions SET taken_at = now() - make_interval(days => $2) WHERE id = $1`, [
        id,
        days,
      ]);
    // Two versions two days apart in one week, ten weeks ago, with different rows:
    // the Tuesday and Thursday of that ISO week, whatever weekday today is.
    const weekday = new Date().getUTCDay() || 7;
    const tuesday = 70 + weekday - 2;
    const [latest] = await versions.list(workspace.id, owner.id);
    await backdate(latest.id, tuesday);
    await sql("UPDATE transactions SET counterparty_name = 'Lidl Mitte' WHERE workspace_id = $1", [
      workspace.id,
    ]);
    const newer = await versions.takeNow(workspace.id, owner.id);
    await backdate(newer.id, tuesday - 2);
    expect(await versions.list(workspace.id, owner.id)).toHaveLength(2);
    // Old enough for collection.
    const old = (Date.now() - 2 * 60 * 60 * 1000) / 1000;
    for (const file of fs.readdirSync(blobsDir(), { recursive: true }) as string[]) {
      const full = path.join(blobsDir(), file);
      if (fs.statSync(full).isFile()) fs.utimesSync(full, old, old);
    }

    await versions.prune(workspace);

    // One a week that far back: the newer stays, the older and its rows go.
    const left = await versions.list(workspace.id, owner.id);
    expect(left.map(version => version.id)).toEqual([newer.id]);
    expect(filesIn(blobsDir()).sort()).toEqual([...newer.fileRefs].sort());
  });

  it('is the owner’s alone: versions hold every member’s rows', async () => {
    await expect(versions.list(workspace.id, randomUUID())).rejects.toThrow(ForbiddenException);
    await expect(versions.takeNow(workspace.id, randomUUID())).rejects.toThrow(ForbiddenException);
  });

  describe('the nightly version', () => {
    let scheduler: VersionSchedulerService;
    let versionWorkspaceId: string;
    // 01:05 UTC is 03:05 in Berlin in October: the owner's night.
    const night = new Date('2026-10-20T01:05:00Z');

    beforeAll(async () => {
      scheduler = new VersionSchedulerService(
        dataSource.getRepository(Workspace),
        dataSource.getRepository(WorkspaceVersion),
        snapshots,
        versions,
      );
      const [{ id }] = await sql(
        "INSERT INTO workspaces (name, currency, owner_id, kind) VALUES ('A past version', 'EUR', $1, 'version') RETURNING id",
        [owner.id],
      );
      versionWorkspaceId = id;
    });

    const scheduledOn = async (workspaceId: string) =>
      sql(
        "SELECT scheduled_for::text AS day, status FROM workspace_versions WHERE workspace_id = $1 AND trigger = 'scheduled'",
        [workspaceId],
      );

    it('is taken at 03:00 the owner’s time, once, however many servers run the job', async () => {
      await scheduler.runNightly(new Date('2026-10-20T05:05:00Z'));
      expect(await scheduledOn(workspace.id)).toEqual([]);

      await Promise.all([scheduler.runNightly(night), scheduler.runNightly(night)]);
      await scheduler.runNightly(night);

      expect(await scheduledOn(workspace.id)).toEqual([{ day: '2026-10-20', status: 'ready' }]);
    });

    it('is not taken of a past version opened to look at', async () => {
      await scheduler.runNightly(night);
      expect(await scheduledOn(versionWorkspaceId)).toEqual([]);
    });
  });

  describe('opening a version', () => {
    let versionId: string;

    beforeAll(async () => {
      const taken = await versions.takeNow(workspace.id, owner.id);
      versionId = taken.id;
    });

    const documentsOf = async (workspaceId: string): Promise<string[]> =>
      (await sql('SELECT file_path FROM statements WHERE workspace_id = $1', [workspaceId])).map(
        (row: { file_path: string }) => row.file_path,
      );

    it('rebuilds it as a read-only workspace of its own, the same one when opened again', async () => {
      const opened = await versions.open(versionId, owner.id);

      expect(opened.kind).toBe('version');
      expect(opened.versionId).toBe(versionId);
      expect(opened.ownerId).toBe(owner.id);
      const [{ count }] = await sql(
        'SELECT COUNT(*)::int AS count FROM transactions WHERE workspace_id = $1',
        [opened.id],
      );
      expect(count).toBe(1);
      const [file] = await documentsOf(opened.id);
      expect(fs.readFileSync(file, 'utf8')).toBe('%PDF-1.4 bank statement');

      expect((await versions.open(versionId, owner.id)).id).toBe(opened.id);
      // From inside it, the list is still the source's.
      expect((await versions.list(opened.id, owner.id)).map(version => version.id)).toContain(
        versionId,
      );
    });

    it('is kept while it is open, even when retention would let the version go', async () => {
      const opened = await versions.open(versionId, owner.id);
      await sql(
        "UPDATE workspace_versions SET taken_at = now() - interval '400 days' WHERE id = $1",
        [versionId],
      );
      await versions.takeNow(workspace.id, owner.id);
      await sql(
        "UPDATE workspace_versions SET taken_at = now() - interval '399 days' WHERE workspace_id = $1 AND id <> $2 AND taken_at > now() - interval '1 day'",
        [workspace.id, versionId],
      );

      await versions.prune(workspace);

      expect(await dataSource.getRepository(Workspace).findOneBy({ id: opened.id })).not.toBeNull();
      expect(await dataSource.getRepository(WorkspaceVersion).findOneBy({ id: versionId })).not.toBeNull();
    });

    it('is closed with the documents restored for it', async () => {
      const opened = await versions.open(versionId, owner.id);
      const files = await documentsOf(opened.id);

      await versions.close(versionId, owner.id);

      expect(await dataSource.getRepository(Workspace).findOneBy({ id: opened.id })).toBeNull();
      for (const file of files) expect(fs.existsSync(file)).toBe(false);
    });

    it('is discarded after a day nobody looked at it', async () => {
      const opened = await versions.open(versionId, owner.id);
      await sql(
        "UPDATE workspace_members SET last_accessed_at = now() - interval '25 hours' WHERE workspace_id = $1",
        [opened.id],
      );
      const fresh = await versions.open(versionId, owner.id);
      expect(fresh.id).toBe(opened.id);
      // Opening again counts as a visit: nothing to discard yet.
      expect(await versions.discardIdle()).toBe(0);

      await sql(
        "UPDATE workspace_members SET last_accessed_at = now() - interval '25 hours' WHERE workspace_id = $1",
        [opened.id],
      );
      expect(await versions.discardIdle()).toBe(1);
      expect(await dataSource.getRepository(Workspace).findOneBy({ id: opened.id })).toBeNull();
    });

    it('is saved as an ordinary workspace named after its day', async () => {
      const copy = await versions.copy(versionId, owner.id);

      expect(copy.kind).toBe('standard');
      expect(copy.versionId).toBeNull();
      expect(copy.name).toMatch(/^Keller Design — \d{4}-\d{2}-\d{2}$/);
      // A copy is no longer the opened version: opening again makes a new one.
      expect((await versions.open(versionId, owner.id)).id).not.toBe(copy.id);
      tempFiles.push(...(await documentsOf(copy.id)));
    });

    it('is the owner’s alone', async () => {
      await expect(versions.open(versionId, randomUUID())).rejects.toThrow(ForbiddenException);
    });
  });
});
