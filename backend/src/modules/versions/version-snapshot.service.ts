import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { Workspace } from '../../entities/workspace.entity';
import {
  WorkspaceVersion,
  WorkspaceVersionStatus,
  WorkspaceVersionTrigger,
} from '../../entities/workspace-version.entity';
import { BackupDataService } from '../backups/backup-data.service';
import { BackupKeyService } from '../backups/backup-key.service';
import { VersionBlobStore } from './version-blob-store';
import { encodePayload } from './version-payload';

/** The version store's payload: rows, the workspace record and where each document is. */
export const VERSION_FORMAT = 1;

export interface VersionPayload {
  formatVersion: number;
  workspace: Record<string, unknown>;
  collections: Record<string, unknown[]>;
  /** Portable document path (as the rows name it) → its hash in the version store. */
  files: Record<string, string>;
}

/**
 * Takes a version of a workspace: its rows and documents, as a backup collects
 * them, into the version store. A day with no changes costs one row: the rows
 * hash the same, and the stored payload of the previous version is reused.
 */
@Injectable()
export class VersionSnapshotService {
  private readonly logger = new Logger(VersionSnapshotService.name);
  private readonly store = new VersionBlobStore();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(WorkspaceVersion)
    private readonly versionRepository: Repository<WorkspaceVersion>,
    private readonly collector: BackupDataService,
    private readonly keyService: BackupKeyService,
  ) {}

  /**
   * Takes one. `claimed` is a nightly row the scheduler already inserted to
   * claim the day; without one a manual version row is made here.
   */
  async take(
    workspace: Workspace,
    trigger: WorkspaceVersionTrigger,
    createdById: string | null,
    claimed?: WorkspaceVersion,
  ): Promise<WorkspaceVersion> {
    const lock = this.dataSource.createQueryRunner();
    await lock.connect();
    try {
      const [{ locked }] = await lock.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [
        `seneca:versions:${workspace.id}`,
      ]);
      if (!locked) {
        if (claimed) await this.fail(claimed, 'Another snapshot of this workspace was running');
        throw new ConflictException(appError('VERSION_SNAPSHOT_RUNNING'));
      }
      try {
        const version =
          claimed ??
          (await this.versionRepository.save(
            this.versionRepository.create({
              workspaceId: workspace.id,
              trigger,
              status: WorkspaceVersionStatus.RUNNING,
              createdById,
            }),
          ));
        return await this.fill(workspace, version);
      } finally {
        await lock.query('SELECT pg_advisory_unlock(hashtext($1))', [
          `seneca:versions:${workspace.id}`,
        ]);
      }
    } finally {
      await lock.release();
    }
  }

  private async fill(workspace: Workspace, version: WorkspaceVersion): Promise<WorkspaceVersion> {
    try {
      const snapshot = await this.collector.collect(workspace.id);
      const files: Record<string, string> = {};
      let fileBytes = 0;
      for (const file of snapshot.files) {
        files[file.path] = await this.store.putBytes(workspace.id, file.contents);
        fileBytes += file.contents.length;
      }
      const payload: VersionPayload = {
        formatVersion: VERSION_FORMAT,
        workspace: this.workspaceRecord(workspace),
        collections: snapshot.collections,
        files,
      };

      const dataKey = randomBytes(32);
      const encoded = await encodePayload(payload, dataKey);
      const previous = await this.previousReady(workspace.id, version.id);
      const unchanged = previous?.payloadSha256 === encoded.plainSha256 && previous.payloadBlob;
      const payloadBlob = unchanged
        ? (previous.payloadBlob as string)
        : await this.store.putBytes(workspace.id, encoded.bytes);

      version.status = WorkspaceVersionStatus.READY;
      version.takenAt = new Date();
      version.payloadSha256 = encoded.plainSha256;
      version.payloadBlob = payloadBlob;
      version.wrappedDataKey = unchanged
        ? (previous.wrappedDataKey as string)
        : this.keyService.encryptDataKey(dataKey);
      version.formatVersion = VERSION_FORMAT;
      version.rowCounts = Object.fromEntries(
        Object.entries(snapshot.collections).map(([table, rows]) => [table, rows.length]),
      );
      version.fileRefs = [payloadBlob, ...new Set(Object.values(files))];
      version.sizeBytes = String(encoded.bytes.length + fileBytes);
      version.errorMessage = null;
      return await this.versionRepository.save(version);
    } catch (error) {
      this.logger.error(`Snapshot of workspace ${workspace.id} failed`, (error as Error).stack);
      return this.fail(version, (error as Error).message);
    }
  }

  private async fail(version: WorkspaceVersion, message: string): Promise<WorkspaceVersion> {
    version.status = WorkspaceVersionStatus.FAILED;
    version.errorMessage = message.slice(0, 500);
    return this.versionRepository.save(version);
  }

  private previousReady(workspaceId: string, exceptId: string) {
    return this.versionRepository
      .createQueryBuilder('version')
      .addSelect('version.wrappedDataKey')
      .where('version.workspaceId = :workspaceId', { workspaceId })
      .andWhere('version.status = :ready', { ready: WorkspaceVersionStatus.READY })
      .andWhere('version.id <> :exceptId', { exceptId })
      .orderBy('version.takenAt', 'DESC')
      .getOne();
  }

  /** What a restore needs of the workspace row itself, beside its tables. */
  private workspaceRecord(workspace: Workspace): Record<string, unknown> {
    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      icon: workspace.icon,
      color: workspace.color,
      backgroundImage: workspace.backgroundImage,
      currency: workspace.currency,
      settings: workspace.settings,
      ledgerBaseCurrency: workspace.ledgerBaseCurrency,
      taxJurisdictionId: workspace.taxJurisdictionId,
      vatStatus: workspace.vatStatus,
    };
  }
}
