import { Controller, Get, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { RevaluationResult as RevaluationResultContract, RevalueLedgerBody } from '../../contracts';
import { LedgerRevaluationList } from '../../contracts/ledger/ledger-reports';
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
  @SchemaResponse(LedgerRevaluationList)
  async list(@WorkspaceId() workspaceId: string): Promise<Revaluation[]> {
    return this.revaluationService.list(workspaceId);
  }

  /** Idempotent per day: repeating it books nothing unless the balances moved. */
  @Post()
  @WorkspaceAuth(Permission.LEDGER_POST)
  @SchemaResponse(RevaluationResultContract)
  async revalue(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(RevalueLedgerBody) dto: RevalueLedgerBody,
  ): Promise<RevaluationResult> {
    return this.revaluationService.revalue(workspaceId, user.id, dto.date);
  }
}
