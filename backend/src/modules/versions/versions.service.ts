import * as fs from 'node:fs/promises';
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { User } from '../../entities/user.entity';
import { Workspace, WorkspaceKind } from '../../entities/workspace.entity';
import { WorkspaceMember, WorkspaceRole } from '../../entities/workspace-member.entity';
import {
  WorkspaceVersion,
  WorkspaceVersionStatus,
  WorkspaceVersionTrigger,
} from '../../entities/workspace-version.entity';
import { BackupKeyService } from '../backups/backup-key.service';
import { BackupRestoreService } from '../backups/backup-restore.service';
import { VersionBlobStore } from './version-blob-store';
import { decodePayload } from './version-payload';
import { localDay, selectVersionsToDelete } from './version-retention';
import { type VersionPayload, VersionSnapshotService } from './version-snapshot.service';

/** How long an opened version is kept after it was last looked at. */
export const OPENED_VERSION_IDLE_MS = 24 * 60 * 60 * 1000;

/** How many versions the list shows: a month of days, half a year of weeks, years of months. */
const LIST_LIMIT = 400;

@Injectable()
export class VersionsService {
  private readonly logger = new Logger(VersionsService.name);
  private readonly store = new VersionBlobStore();

  constructor(
    @InjectRepository(WorkspaceVersion)
    private readonly versionRepository: Repository<WorkspaceVersion>,
    @InjectRepository(Workspace) private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    private readonly snapshots: VersionSnapshotService,
    private readonly restorer: BackupRestoreService,
    private readonly keyService: BackupKeyService,
  ) {}

  /** The versions of the workspace — of its source, when it is itself an opened version. */
  async list(workspaceId: string, userId: string): Promise<WorkspaceVersion[]> {
    const source = await this.ownedWorkspace(await this.sourceOf(workspaceId), userId);
    return this.versionRepository.find({
      where: { workspaceId: source.id },
      order: { takenAt: 'DESC' },
      take: LIST_LIMIT,
    });
  }

  async takeNow(workspaceId: string, userId: string): Promise<WorkspaceVersion> {
    const workspace = await this.ownedWorkspace(workspaceId, userId);
    const version = await this.snapshots.take(workspace, WorkspaceVersionTrigger.MANUAL, userId);
    await this.prune(workspace);
    return version;
  }

  /**
   * Lets go of the versions the retention no longer keeps, then of the stored
   * documents and payloads no remaining version refers to.
   */
  async prune(workspace: Workspace, now = new Date()): Promise<void> {
    const versions = await this.versionRepository.find({
      where: { workspaceId: workspace.id },
      select: {
        id: true,
        takenAt: true,
        status: true,
        fileRefs: true,
      },
    });
    const timeZone = await this.ownerTimeZone(workspace.ownerId);
    // An opened version stays while someone looks at it; idle ones are discarded first.
    const openedRows = versions.length
      ? await this.workspaceRepository.find({
          where: {
            kind: WorkspaceKind.VERSION,
            versionId: In(versions.map(version => version.id)),
          },
          select: {
            id: true,
            versionId: true,
          },
        })
      : [];
    const opened = new Set(openedRows.map(row => row.versionId as string));
    const doomed = selectVersionsToDelete(versions, now, timeZone, opened);
    if (doomed.length > 0) {
      await this.versionRepository.delete({ id: In(doomed), workspaceId: workspace.id });
    }
    const gone = new Set(doomed);
    const referenced = new Set(
      versions.filter(version => !gone.has(version.id)).flatMap(version => version.fileRefs),
    );
    await this.store.collectGarbage(workspace.id, referenced);
  }

  /** The owner's time zone: their days decide which version a day keeps. */
  async ownerTimeZone(ownerId: string | null): Promise<string> {
    const owner = ownerId
      ? await this.userRepository.findOne({
          where: { id: ownerId },
          select: {
            id: true,
            timeZone: true,
          },
        })
      : null;
    const zone = owner?.timeZone;
    if (zone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: zone });
        return zone;
      } catch {
        // An unknown zone name falls back to UTC rather than stopping the job.
      }
    }
    return 'UTC';
  }

  /**
   * Opens a version as a read-only workspace of its own and returns it. The
   * same person opening the same version again gets the copy already made.
   */
  async open(versionId: string, userId: string): Promise<Workspace> {
    const version = await this.readyVersion(versionId, userId);
    const opened = await this.workspaceRepository.findOne({
      where: { versionId, ownerId: userId, kind: WorkspaceKind.VERSION },
    });
    if (opened) {
      await this.touch(opened.id, userId);
      return opened;
    }

    const payload = await decodePayload<VersionPayload>(
      await this.store.readBytes(version.workspaceId, version.payloadBlob as string),
      this.keyService.decryptDataKey(version.wrappedDataKey as string),
    );
    const files = new Map<string, Buffer>();
    for (const [portablePath, sha] of Object.entries(payload.files)) {
      files.set(portablePath, await this.store.readBytes(version.workspaceId, sha));
    }
    const workspace = await this.restorer.restoreOpened(
      { collections: { workspace: [payload.workspace], ...payload.collections }, files },
      { id: userId } as User,
      { name: version.workspace.name, kind: WorkspaceKind.VERSION, versionId },
    );
    await this.touch(workspace.id, userId);
    return workspace;
  }

  /** Keeps a version as an ordinary workspace: a copy that is no longer read only. */
  async copy(versionId: string, userId: string, name?: string | null): Promise<Workspace> {
    const version = await this.readyVersion(versionId, userId);
    const opened = await this.open(versionId, userId);
    const timeZone = await this.ownerTimeZone(userId);
    opened.kind = WorkspaceKind.STANDARD;
    opened.versionId = null;
    opened.name =
      name?.trim() || `${version.workspace.name} — ${localDay(version.takenAt, timeZone)}`;
    return this.workspaceRepository.save(opened);
  }

  /** Closes an opened version: the copy and the documents restored for it go. */
  async close(versionId: string, userId: string): Promise<void> {
    const opened = await this.workspaceRepository.find({
      where: { versionId, ownerId: userId, kind: WorkspaceKind.VERSION },
    });
    for (const workspace of opened) await this.discard(workspace);
  }

  /** Discards the opened versions nobody has looked at for a day. */
  async discardIdle(now = new Date()): Promise<number> {
    const idle = await this.memberRepository.find({
      where: {
        role: WorkspaceRole.OWNER,
        lastAccessedAt: LessThan(new Date(now.getTime() - OPENED_VERSION_IDLE_MS)),
        workspace: { kind: WorkspaceKind.VERSION },
      },
      relations: {
        workspace: true,
      },
    });
    for (const member of idle) await this.discard(member.workspace);
    return idle.length;
  }

  private async discard(workspace: Workspace): Promise<void> {
    const documents: Array<{ path: string | null; paths: string[] | null }> =
      await this.workspaceRepository.query(
        `SELECT file_path AS path, NULL AS paths FROM statements WHERE workspace_id = $1
         UNION ALL SELECT NULL, attachment_paths FROM receipts WHERE workspace_id = $1`,
        [workspace.id],
      );
    await this.workspaceRepository.delete({ id: workspace.id, kind: WorkspaceKind.VERSION });
    const files = documents.flatMap(row => [row.path, ...(row.paths ?? [])]).filter(Boolean);
    for (const file of files) {
      await fs.rm(file as string, { force: true }).catch(error => {
        this.logger.warn(`Could not remove ${file}: ${(error as Error).message}`);
      });
    }
  }

  private async readyVersion(versionId: string, userId: string): Promise<WorkspaceVersion> {
    const version = await this.versionRepository
      .createQueryBuilder('version')
      .addSelect('version.wrappedDataKey')
      .leftJoinAndSelect('version.workspace', 'workspace')
      .where('version.id = :versionId', { versionId })
      .getOne();
    if (!version || version.status !== WorkspaceVersionStatus.READY || !version.payloadBlob) {
      throw new NotFoundException(appError('VERSION_NOT_FOUND'));
    }
    if (version.workspace.ownerId !== userId) {
      throw new ForbiddenException(appError('VERSION_LIST_OWNER_ONLY'));
    }
    return version;
  }

  /** What "last looked at" means for an opened version: the owner's last visit. */
  private async touch(workspaceId: string, userId: string): Promise<void> {
    await this.memberRepository.update({ workspaceId, userId }, { lastAccessedAt: new Date() });
  }

  /** An opened version answers for the workspace it was taken of. */
  private async sourceOf(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: {
        id: true,
        kind: true,
        versionId: true,
      },
    });
    if (workspace?.kind !== WorkspaceKind.VERSION || !workspace.versionId) return workspaceId;
    const version = await this.versionRepository.findOne({
      where: { id: workspace.versionId },
      select: {
        id: true,
        workspaceId: true,
      },
    });
    return version?.workspaceId ?? workspaceId;
  }

  /** Versions hold every row of the workspace, including other members' private ones. */
  private async ownedWorkspace(workspaceId: string, userId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException(appError('VERSION_LIST_OWNER_ONLY'));
    }
    return workspace;
  }
}
