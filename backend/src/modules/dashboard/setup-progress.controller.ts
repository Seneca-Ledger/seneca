import { Controller, Get, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { SetupProgress as SetupProgressContract } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { type SetupProgress, SetupProgressService } from './setup-progress.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class SetupProgressController {
  constructor(private readonly setupProgressService: SetupProgressService) {}

  @Get('setup-progress')
  @SchemaResponse(SetupProgressContract)
  async getSetupProgress(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ): Promise<SetupProgress> {
    return this.setupProgressService.getSetupProgress(workspaceId, user);
  }
}
