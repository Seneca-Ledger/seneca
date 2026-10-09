import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ViewPreference } from '../../entities/view-preference.entity';

@Injectable()
export class ViewPreferencesService {
  constructor(
    @InjectRepository(ViewPreference)
    private readonly repository: Repository<ViewPreference>,
  ) {}

  /** What this person last left on this page, or nothing if they never did. */
  async read(
    userId: string,
    workspaceId: string,
    scope: string,
  ): Promise<Record<string, unknown> | null> {
    const saved = await this.repository.findOne({
      where: { userId, workspaceId, scope },
      select: ['state'],
    });
    return saved?.state ?? null;
  }

  /**
   * Replaces the page's remembered state.
   *
   * An upsert on the unique key rather than find-then-save: two tabs of the
   * same page settle on one row instead of racing to insert two.
   */
  async write(
    userId: string,
    workspaceId: string,
    scope: string,
    state: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    await this.repository.upsert(
      { userId, workspaceId, scope, state },
      { conflictPaths: ['userId', 'workspaceId', 'scope'], skipUpdateIfNoValuesChanged: true },
    );
    return state;
  }
}
