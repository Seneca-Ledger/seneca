import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { WorkspaceContextGuard } from './guards/workspace-context.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceMember])],
  providers: [WorkspaceContextGuard],
  exports: [WorkspaceContextGuard],
})
export class CommonModule {}
