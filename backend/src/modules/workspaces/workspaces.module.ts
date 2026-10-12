import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Integration, User, Workspace, WorkspaceInvitation, WorkspaceMember } from '../../entities';
import { ApplicationSettingsModule } from '../application-settings/application-settings.module';
import { AuditModule } from '../audit/audit.module';
import { BalanceModule } from '../balance/balance.module';
import { CategoriesModule } from '../categories/categories.module';
import { TaxModule } from '../tax/tax.module';
import { WorkspaceBackgroundsController } from './workspace-backgrounds.controller';
import { WorkspaceBackgroundsService } from './workspace-backgrounds.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceMember, WorkspaceInvitation, User, Integration]),
    ApplicationSettingsModule,
    AuditModule,
    BalanceModule,
    CategoriesModule,
    TaxModule,
  ],
  providers: [WorkspacesService, WorkspaceBackgroundsService],
  // Backgrounds first: its literal `backgrounds/...` paths must not be read as a workspace id.
  controllers: [WorkspaceBackgroundsController, WorkspacesController],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
