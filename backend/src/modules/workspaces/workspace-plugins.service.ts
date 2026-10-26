import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import {
  readPluginSettings,
  type WorkspacePluginKey,
} from '../../common/utils/workspace-plugins.util';
import { Workspace } from '../../entities/workspace.entity';

/** Answers whether a plugin is switched on for a workspace. */
@Injectable()
export class WorkspacePluginsService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  async isEnabled(workspaceId: string, plugin: WorkspacePluginKey): Promise<boolean> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: {
        id: true,
        settings: true,
      },
    });
    return readPluginSettings(workspace)[plugin];
  }

  async assertEnabled(workspaceId: string, plugin: WorkspacePluginKey): Promise<void> {
    if (!(await this.isEnabled(workspaceId, plugin))) {
      throw new ForbiddenException(appError('PLUGIN_DISABLED', { plugin }));
    }
  }
}
