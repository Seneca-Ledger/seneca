import { Controller, Get, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { RevalueLedgerBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Revaluation, RevaluationResult } from './ledger-revaluation.service';
import { LedgerRevaluationService } from './ledger-revaluation.service';

/** Revaluing foreign-currency balances. Audited by the service. */
@Controller('ledger/revaluations')
export class LedgerRevaluationsController {
  constructor(private readonly revaluationService: LedgerRevaluationService) {}

  @Get()
  @WorkspaceAuth(Permission.LEDGER_VIEW)
  async list(@WorkspaceId() workspaceId: string): Promise<Revaluation[]> {
    return this.revaluationService.list(workspaceId);
  }

  /** Idempotent per day: repeating it books nothing unless the balances moved. */
  @Post()
  @WorkspaceAuth(Permission.LEDGER_POST)
  async revalue(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(RevalueLedgerBody) dto: RevalueLedgerBody,
  ): Promise<RevaluationResult> {
    return this.revaluationService.revalue(workspaceId, user.id, dto.date);
  }
}
