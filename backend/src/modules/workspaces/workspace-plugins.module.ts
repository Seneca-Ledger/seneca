import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspacePluginsService } from './workspace-plugins.service';

/** Separate from `WorkspacesModule` for the same reason as `WorkspaceCurrencyModule`. */
@Module({
  imports: [TypeOrmModule.forFeature([Workspace])],
  providers: [WorkspacePluginsService],
  exports: [WorkspacePluginsService],
})
export class WorkspacePluginsModule {}
