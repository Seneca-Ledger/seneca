import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, EntityManager, EntityMetadata, Repository } from 'typeorm';
import { appDefaultCurrency } from '../../common/utils/currency.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { WorkspaceRole } from '../../entities';
import type { User } from '../../entities/user.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { BackupArchiveService, type OpenedBackup } from './backup-archive.service';

const RESTORE_ORDER = [
  'categories',
  'branches',
  'wallets',
  'tax_rates',
  'folders',
  'tags',
  'balance_accounts',
  'custom_tables',
  'statements',
  'file_versions',
  'transactions',
  'receipts',
  'data_entries',
  'custom_table_columns',
  'custom_table_rows',
  'custom_table_column_styles',
  'custom_table_cell_styles',
];

/**
 * Collections that older backups may carry but whose tables no longer exist
 * (the Google Sheets import jobs went with the integration). Skipped on
 * restore so those archives still restore instead of failing as unsupported.
 */
const REMOVED_COLLECTIONS = new Set(['custom_table_import_jobs']);

/**
 * Collections that backups made before they were excluded still carry, and
 * that cannot come back: people and per-member rows rather than workspace
 * data (the restore makes its own owner membership, and every member's row
 * would land on the restorer), and share links whose required token the
 * backup stripped.
 */
const UNRESTORABLE_COLLECTIONS = new Set([
  'custom_table_shares',
  // Derived and regenerated; its dedup key is unique per user, so a copy of
  // the same user's live insights would collide.
  'insights',
  'users',
  'user_ai_settings',
  'workspace_invitations',
  'workspace_members',
]);

/**
 * Public links of the source workspace, unique across all workspaces. The
 * restored copy starts without one; sending the document again makes a new link.
 */
const PUBLIC_TOKEN_PROPERTIES = new Set(['shareToken']);

const USER_REFERENCE_PROPERTIES = new Set([
  'userId',
  'ownerId',
  'ownerUserId',
  'createdById',
  'createdBy',
  'updatedByUserId',
  'connectedByUserId',
  'invitedById',
  'actorId',
  'confirmedBy',
  'finalizedBy',
  'postedBy',
  'recipientId',
  'sentById',
  'uploadedById',
]);

/** A journal entry as first inserted: a draft has no number and no booking time. */
const asDraftEntry = (entry: Record<string, unknown>): Record<string, unknown> => ({
  ...entry,
  status: 'draft',
  entryNo: null,
  postedAt: null,
});

@Injectable()
export class BackupRestoreService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Workspace) private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly archiveService: BackupArchiveService,
  ) {}

  async preview(archive: Buffer, password: string) {
    const opened = await this.archiveService.open(archive, password);
    return {
      workspaceName: this.sourceWorkspaceName(opened),
      createdAt: opened.manifest.createdAt,
      collections: opened.manifest.collections,
      fileCount: opened.manifest.files.length,
    };
  }

  async restore(
    archive: Buffer,
    password: string,
    user: User,
    workspaceName?: string,
  ): Promise<Workspace> {
    const opened = await this.archiveService.open(archive, password);
    const sourceWorkspace = this.sourceWorkspace(opened);
    const workspace = await this.workspaceRepository.save(
      this.workspaceRepository.create({
        name:
          workspaceName?.trim() || `Restored ${this.sourceWorkspaceName(opened) ?? 'workspace'}`,
        description: this.stringOrNull(sourceWorkspace.description),
        icon: this.stringOrNull(sourceWorkspace.icon),
        color: this.stringOrNull(sourceWorkspace.color),
        backgroundImage: this.stringOrNull(sourceWorkspace.backgroundImage),
        // The column is required; a backup taken before that falls back the same
        // way the RequireWorkspaceCurrency migration backfilled missing ones.
        currency: this.stringOrNull(sourceWorkspace.currency) ?? appDefaultCurrency(),
        settings: this.objectOrNull(sourceWorkspace.settings),
        ownerId: user.id,
        isFavorite: false,
      }),
    );
    const stagedFiles: Array<{ stagedPath: string; targetPath: string }> = [];
    const restoreDirectory = await fs.mkdtemp(path.join(resolveUploadsDir(), '.restore-'));

    try {
      await this.workspaceMemberRepository.save(
        this.workspaceMemberRepository.create({
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceRole.OWNER,
          permissions: null,
          invitedById: user.id,
        }),
      );
      const idMap = this.buildIdMap(opened, sourceWorkspace.id, workspace.id);
      const prepared = await this.prepareCollections(
        opened,
        idMap,
        workspace.id,
        user.id,
        restoreDirectory,
        stagedFiles,
      );
      await this.dataSource.transaction(async manager => {
        for (const { metadata, values } of await this.inForeignKeyOrder(manager, prepared)) {
          if (values.length > 0) {
            await manager
              .getRepository(metadata.target)
              .insert(metadata.tableName === 'journal_entries' ? values.map(asDraftEntry) : values);
          }
        }
        await this.bookJournalEntries(manager, prepared);
      });
      await Promise.all(
        stagedFiles.map(async file => {
          await fs.mkdir(path.dirname(file.targetPath), { recursive: true });
          await fs.rename(file.stagedPath, file.targetPath);
        }),
      );
      await fs.rm(restoreDirectory, { recursive: true, force: true });
      return workspace;
    } catch (error) {
      await fs.rm(restoreDirectory, { recursive: true, force: true }).catch(() => undefined);
      await Promise.all(
        stagedFiles.map(file => fs.rm(file.targetPath, { force: true }).catch(() => undefined)),
      );
      await this.workspaceRepository.delete(workspace.id).catch(() => undefined);
      throw error;
    }
  }

  /**
   * The prepared tables in an order that inserts every row after the rows it
   * points at. Read from the database, not the entities: some foreign keys
   * exist only in migrations (categories.ledger_account_id). Ties keep
   * RESTORE_ORDER; a table's references to itself are checked at the end of
   * its one insert.
   */
  private async inForeignKeyOrder<T extends { metadata: EntityMetadata }>(
    manager: EntityManager,
    prepared: T[],
  ): Promise<T[]> {
    const tables = prepared.map(item => item.metadata.tableName);
    const references: Array<{ source: string; target: string }> = await manager.query(
      `SELECT DISTINCT src.relname AS source, tgt.relname AS target
           FROM pg_constraint fk
           JOIN pg_class src ON src.oid = fk.conrelid
           JOIN pg_class tgt ON tgt.oid = fk.confrelid
           JOIN pg_namespace ns ON ns.oid = src.relnamespace
          WHERE fk.contype = 'f' AND ns.nspname = current_schema() AND src.relname = ANY($1::text[])`,
      [tables],
    );
    const waitsOn = new Map(tables.map(table => [table, new Set<string>()]));
    for (const { source, target } of references) {
      if (source !== target && waitsOn.has(target)) waitsOn.get(source)?.add(target);
    }
    const remaining = [...prepared];
    const ordered: T[] = [];
    while (remaining.length > 0) {
      const pending = new Set(remaining.map(item => item.metadata.tableName));
      const ready = remaining.findIndex(item =>
        [...(waitsOn.get(item.metadata.tableName) ?? [])].every(target => !pending.has(target)),
      );
      // A cycle between tables: keep the old order and let the database name the key.
      ordered.push(...remaining.splice(ready === -1 ? 0 : ready, 1));
    }
    return ordered;
  }

  /**
   * Books the journal entries inserted as drafts, now that their lines are in.
   * The ledger's triggers allow no other way: lines cannot be added to a
   * booked entry, and only a posted entry can become reversed.
   */
  private async bookJournalEntries(
    manager: EntityManager,
    prepared: Array<{ metadata: EntityMetadata; values: Record<string, unknown>[] }>,
  ): Promise<void> {
    const entries = prepared.find(item => item.metadata.tableName === 'journal_entries');
    if (!entries) return;
    const repository = manager.getRepository(entries.metadata.target);
    for (const entry of entries.values) {
      if (entry.status !== 'posted' && entry.status !== 'reversed') continue;
      await repository.update(String(entry.id), {
        status: 'posted',
        entryNo: entry.entryNo,
        postedAt: entry.postedAt,
      });
      if (entry.status === 'reversed') {
        await repository.update(String(entry.id), { status: 'reversed' });
      }
    }
  }

  /** The archived workspace's name, when it has one that reads as a name. */
  private sourceWorkspaceName(opened: OpenedBackup): string | null {
    const name = this.sourceWorkspace(opened).name;
    return typeof name === 'string' && name.trim() ? name : null;
  }

  private sourceWorkspace(opened: OpenedBackup): Record<string, unknown> {
    const workspace = opened.collections.workspace?.[0];
    if (workspace && typeof workspace === 'object') return workspace as Record<string, unknown>;
    throw new BadRequestException('Backup does not contain workspace data');
  }

  private buildIdMap(
    opened: OpenedBackup,
    sourceWorkspaceId: unknown,
    workspaceId: string,
  ): Map<string, string> {
    const map = new Map<string, string>();
    if (typeof sourceWorkspaceId === 'string') map.set(sourceWorkspaceId, workspaceId);
    for (const [tableName, rows] of Object.entries(opened.collections)) {
      if (tableName === 'workspace') continue;
      for (const row of rows) {
        const id = (row as Record<string, unknown>).id;
        if (typeof id === 'string') map.set(id, randomUUID());
      }
    }
    return map;
  }

  private sortedCollections(
    collections: Record<string, unknown[]>,
  ): Array<[string, Record<string, unknown>[]]> {
    const entries = Object.entries(collections)
      .filter(
        ([tableName]) =>
          tableName !== 'workspace' &&
          !REMOVED_COLLECTIONS.has(tableName) &&
          !UNRESTORABLE_COLLECTIONS.has(tableName),
      )
      .map(
        ([tableName, rows]) =>
          [tableName, rows as Record<string, unknown>[]] as [string, Record<string, unknown>[]],
      );
    return entries.sort(([left], [right]) => this.order(left) - this.order(right));
  }

  private order(tableName: string): number {
    const index = RESTORE_ORDER.indexOf(tableName);
    return index === -1 ? RESTORE_ORDER.length : index;
  }

  private mapRecord(
    metadata: EntityMetadata,
    source: Record<string, unknown>,
    idMap: Map<string, string>,
    workspaceId: string,
    userId: string,
  ): Record<string, unknown> {
    const mapped = metadata.columns.reduce<Record<string, unknown>>((record, column) => {
      const property = column.propertyName;
      if (source[property] === undefined) return record;
      if (property === 'workspaceId') {
        record[property] = workspaceId;
      } else if (property === 'id') {
        record[property] = idMap.get(String(source[property])) || randomUUID();
      } else if (PUBLIC_TOKEN_PROPERTIES.has(property)) {
        record[property] = null;
      } else if (USER_REFERENCE_PROPERTIES.has(property)) {
        record[property] = source[property] === null ? null : userId;
      } else if (property.endsWith('Id') && typeof source[property] === 'string') {
        record[property] = idMap.get(source[property] as string) || source[property];
      } else {
        record[property] = this.mapNestedIds(source[property], idMap);
      }
      return record;
    }, {});
    if (metadata.tableName === 'file_versions' && this.isBase64FileData(source.fileData)) {
      mapped.fileData = Buffer.from(source.fileData.value, 'base64');
    }
    return mapped;
  }

  private async prepareCollections(
    opened: OpenedBackup,
    idMap: Map<string, string>,
    workspaceId: string,
    userId: string,
    restoreDirectory: string,
    stagedFiles: Array<{ stagedPath: string; targetPath: string }>,
  ): Promise<Array<{ metadata: EntityMetadata; values: Record<string, unknown>[] }>> {
    const prepared: Array<{ metadata: EntityMetadata; values: Record<string, unknown>[] }> = [];
    for (const [tableName, rows] of this.sortedCollections(opened.collections)) {
      const metadata = this.dataSource.entityMetadatas.find(item => item.tableName === tableName);
      if (!metadata)
        throw new BadRequestException(`Backup contains unsupported collection: ${tableName}`);
      const values: Record<string, unknown>[] = [];
      for (const row of rows) {
        const mapped = this.mapRecord(metadata, row, idMap, workspaceId, userId);
        await this.prepareDocumentPaths(
          tableName,
          row,
          mapped,
          opened.files,
          restoreDirectory,
          stagedFiles,
        );
        values.push(mapped);
      }
      prepared.push({ metadata, values });
    }
    return prepared;
  }

  private async prepareDocumentPaths(
    tableName: string,
    source: Record<string, unknown>,
    mapped: Record<string, unknown>,
    files: Map<string, Buffer>,
    restoreDirectory: string,
    stagedFiles: Array<{ stagedPath: string; targetPath: string }>,
  ): Promise<void> {
    if (tableName === 'statements' || tableName === 'report_history') {
      if (typeof source.filePath === 'string') {
        mapped.filePath = await this.stageDocument(
          source.filePath,
          String(mapped.id),
          files,
          restoreDirectory,
          stagedFiles,
        );
      }
      return;
    }
    if (tableName === 'receipts' && Array.isArray(source.attachmentPaths)) {
      mapped.attachmentPaths = await Promise.all(
        source.attachmentPaths
          .filter((value): value is string => typeof value === 'string')
          .map(portablePath =>
            this.stageDocument(
              portablePath,
              String(mapped.id),
              files,
              restoreDirectory,
              stagedFiles,
            ),
          ),
      );
    }
  }

  private async stageDocument(
    portablePath: string,
    restoredId: string,
    files: Map<string, Buffer>,
    restoreDirectory: string,
    stagedFiles: Array<{ stagedPath: string; targetPath: string }>,
  ): Promise<string> {
    const contents = files.get(portablePath);
    if (!contents) throw new BadRequestException(`Backup document is missing: ${portablePath}`);
    const safeName = path.basename(portablePath);
    const targetPath = path.join(resolveUploadsDir(), `restored-${restoredId}-${safeName}`);
    const stagedPath = path.join(restoreDirectory, `${randomUUID()}-${safeName}`);
    await fs.writeFile(stagedPath, contents, { flag: 'wx' });
    stagedFiles.push({ stagedPath, targetPath });
    return targetPath;
  }

  private mapNestedIds(value: unknown, idMap: Map<string, string>): unknown {
    if (typeof value === 'string') return idMap.get(value) || value;
    if (Array.isArray(value)) return value.map(item => this.mapNestedIds(item, idMap));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
          key,
          this.mapNestedIds(nested, idMap),
        ]),
      );
    }
    return value;
  }

  private isBase64FileData(value: unknown): value is { encoding: 'base64'; value: string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as Record<string, unknown>).encoding === 'base64' &&
      typeof (value as Record<string, unknown>).value === 'string'
    );
  }

  private stringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private objectOrNull(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
