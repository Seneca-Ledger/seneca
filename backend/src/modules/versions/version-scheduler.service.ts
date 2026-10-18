import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { NOT_DEMO_WORKSPACE } from '../../common/workspaces/demo-workspaces';
import { Workspace, WorkspaceKind } from '../../entities/workspace.entity';
import {
  WorkspaceVersion,
  WorkspaceVersionStatus,
  WorkspaceVersionTrigger,
} from '../../entities/workspace-version.entity';
import { localDay } from './version-retention';
import { VersionSnapshotService } from './version-snapshot.service';
import { VersionsService } from './versions.service';

/** The owner's local hour the nightly version is taken at. */
export const NIGHTLY_HOUR = 3;

/** The hour (0-23) a moment falls on in a time zone. */
export function localHour(at: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at),
  );
}

/**
 * Takes each workspace's nightly version at 03:00 its owner's time, then lets
 * old versions go. Runs hourly; the unique (workspace, day) index lets exactly
 * one server claim a workspace's night, however many run this.
 */
@Injectable()
export class VersionSchedulerService {
  private readonly logger = new Logger(VersionSchedulerService.name);

  constructor(
    @InjectRepository(Workspace) private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceVersion)
    private readonly versionRepository: Repository<WorkspaceVersion>,
    private readonly snapshots: VersionSnapshotService,
    private readonly versions: VersionsService,
  ) {}

  @Cron('5 * * * *')
  async runNightly(now = new Date()): Promise<void> {
    // Only ordinary workspaces: a past version opened to look at is not versioned
    // again, and a demo is sample data a new request makes afresh.
    const workspaces = await this.workspaceRepository.find({
      where: { kind: WorkspaceKind.STANDARD, ...NOT_DEMO_WORKSPACE },
    });
    for (const workspace of workspaces) {
      try {
        const timeZone = await this.versions.ownerTimeZone(workspace.ownerId);
        if (localHour(now, timeZone) !== NIGHTLY_HOUR) continue;
        const claimed = await this.claim(workspace.id, localDay(now, timeZone));
        if (!claimed) continue;
        await this.snapshots.take(workspace, WorkspaceVersionTrigger.SCHEDULED, null, claimed);
        await this.versions.prune(workspace, now);
      } catch (error) {
        this.logger.error(`Nightly version of ${workspace.id} failed`, (error as Error).stack);
      }
    }
  }

  /** Opened versions are copies kept for looking at; a day unvisited, they go. */
  @Cron('35 * * * *')
  async discardIdleOpened(now = new Date()): Promise<void> {
    const discarded = await this.versions.discardIdle(now);
    if (discarded > 0) this.logger.log(`Discarded ${discarded} idle opened versions`);
  }

  /** The night's row, or null when another server (or an earlier run) has it. */
  private async claim(workspaceId: string, day: string): Promise<WorkspaceVersion | null> {
    const inserted: Array<{ id: string }> = await this.versionRepository.query(
      `INSERT INTO workspace_versions (workspace_id, trigger, status, scheduled_for)
       VALUES ($1, 'scheduled', $2, $3)
       ON CONFLICT (workspace_id, scheduled_for) WHERE trigger = 'scheduled' DO NOTHING
       RETURNING id`,
      [workspaceId, WorkspaceVersionStatus.RUNNING, day],
    );
    return inserted[0] ? this.versionRepository.findOneBy({ id: inserted[0].id }) : null;
  }
}
