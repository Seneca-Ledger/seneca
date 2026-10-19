import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceCurrencyService } from './workspace-currency.service';

/**
 * Deliberately separate from `WorkspacesModule`: half the feature modules need
 * the workspace's currency, and almost none of them should depend on workspace
 * membership, invitations and the rest of what that module pulls in.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Workspace])],
  providers: [WorkspaceCurrencyService],
  exports: [WorkspaceCurrencyService],
})
export class WorkspaceCurrencyModule {}
