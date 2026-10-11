import { Controller, Get, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { type SetupProgress, SetupProgressService } from './setup-progress.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class SetupProgressController {
  constructor(private readonly setupProgressService: SetupProgressService) {}

  @Get('setup-progress')
  async getSetupProgress(@WorkspaceId() workspaceId: string): Promise<SetupProgress> {
    return this.setupProgressService.getSetupProgress(workspaceId);
  }
}
