import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { User } from '../../entities/user.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceVersion, WorkspaceVersionTrigger } from '../../entities/workspace-version.entity';
import { VersionBlobStore } from './version-blob-store';
import { selectVersionsToDelete } from './version-retention';
import { VersionSnapshotService } from './version-snapshot.service';

/** How many versions the list shows: a month of days, half a year of weeks, years of months. */
const LIST_LIMIT = 400;

@Injectable()
export class VersionsService {
  private readonly store = new VersionBlobStore();

  constructor(
    @InjectRepository(WorkspaceVersion)
    private readonly versionRepository: Repository<WorkspaceVersion>,
    @InjectRepository(Workspace) private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly snapshots: VersionSnapshotService,
  ) {}

  async list(workspaceId: string, userId: string): Promise<WorkspaceVersion[]> {
    await this.ownedWorkspace(workspaceId, userId);
    return this.versionRepository.find({
      where: { workspaceId },
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
      select: ['id', 'takenAt', 'status', 'fileRefs'],
    });
    const timeZone = await this.ownerTimeZone(workspace.ownerId);
    const doomed = selectVersionsToDelete(versions, now, timeZone);
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
      ? await this.userRepository.findOne({ where: { id: ownerId }, select: ['id', 'timeZone'] })
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
