import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { Workspace } from '../../../entities';
import type { WorkspaceResponseDto } from '../dto/workspace-response.dto';
import { WorkspacesService } from '../workspaces.service';
import { DEMO_CURRENCY, generateDemoData } from './demo-data.generator';
import { isDateOnly, toDateOnly } from './demo-dates';
import { seedDemoWorkspace } from './demo-workspace.seeder';

/** The partial unique index that keeps it to one demo per user (migration 1787300000000). */
const ONE_DEMO_PER_USER = 'UQ_workspaces_demo_of_user';

/**
 * The date the demo's twelve months end on: `DEMO_DATA_ANCHOR_DATE`
 * (`YYYY-MM-DD`) when set — the guide's screenshots pin it so they come out
 * the same on every run — else today.
 */
export function demoAnchorDate(now = new Date()): string {
  const pinned = process.env.DEMO_DATA_ANCHOR_DATE?.trim();
  if (pinned) {
    if (!isDateOnly(pinned)) {
      throw new Error('DEMO_DATA_ANCHOR_DATE must be a date as YYYY-MM-DD');
    }
    return pinned;
  }
  return toDateOnly(now);
}

@Injectable()
export class DemoWorkspaceService {
  private readonly logger = new Logger(DemoWorkspaceService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly workspacesService: WorkspacesService,
  ) {}

  /**
   * The caller's demo workspace, made the first time: an ordinary workspace
   * (owner membership, categories, balance accounts and the rest of the
   * defaults), then marked as the user's demo and filled with sample data in
   * one transaction. Asking again answers the same workspace; after the user
   * deleted it, a fresh one.
   *
   * Creating the workspace is not transactional, so a failed fill deletes the
   * half-made workspace. Two requests at once both create one; the mark's
   * unique index lets one win, and the other removes its own and answers the
   * winner's. `created` tells the two apart (201 or 200).
   */
  async getOrCreate(
    userId: string,
    name: string,
  ): Promise<{ workspace: WorkspaceResponseDto; created: boolean }> {
    const existing = await this.findDemoId(userId);
    if (existing) {
      return { workspace: await this.summary(existing, userId), created: false };
    }

    const anchor = demoAnchorDate();
    const created = await this.workspacesService.createWorkspace(userId, {
      name,
      currency: DEMO_CURRENCY,
    });
    try {
      await this.dataSource.transaction(async manager => {
        await manager.update(Workspace, { id: created.id }, { demoOfUserId: userId });
        await seedDemoWorkspace(
          manager,
          { workspaceId: created.id, userId },
          generateDemoData(anchor),
        );
      });
    } catch (error) {
      await this.workspaceRepository.delete({ id: created.id });
      const winner = isOneDemoPerUserViolation(error) ? await this.findDemoId(userId) : null;
      if (winner) {
        return { workspace: await this.summary(winner, userId), created: false };
      }
      this.logger.error(
        `Filling demo workspace ${created.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
    return { workspace: created, created: true };
  }

  private async findDemoId(userId: string): Promise<string | null> {
    const demo = await this.workspaceRepository.findOne({
      where: { demoOfUserId: userId },
      select: {
        id: true,
      },
    });
    return demo?.id ?? null;
  }

  private async summary(workspaceId: string, userId: string): Promise<WorkspaceResponseDto> {
    return (await this.workspacesService.getWorkspaceById(
      workspaceId,
      userId,
    )) as WorkspaceResponseDto;
  }
}

function isOneDemoPerUserViolation(error: unknown): boolean {
  const driverError = error as { code?: string; constraint?: string };
  return driverError.code === '23505' && driverError.constraint === ONE_DEMO_PER_USER;
}
