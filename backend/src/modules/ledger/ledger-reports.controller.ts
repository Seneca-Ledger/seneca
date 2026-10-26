import { BadRequestException, Controller, Get } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import {
  AccountLedger as AccountLedgerContract,
  AccountLedgerQuery,
  LedgerDateQuery,
  LedgerPeriodQuery,
  LedgerRecordParams,
  TrialBalance as TrialBalanceContract,
} from '../../contracts';
import {
  type AccountLedger,
  type BalanceSheet,
  LedgerReportsService,
  type ProfitAndLoss,
  type TrialBalance,
} from './ledger-reports.service';

function assertPeriod(query: LedgerPeriodQuery): void {
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
    throw new BadRequestException(appError('LEDGER_REPORT_RANGE_INVALID'));
  }
}

/**
 * Reports built from the journal. Each refuses with LEDGER_NOT_UP_TO_DATE
 * while transactions are still being booked, unless `allowStale=true`.
 */
@Controller('ledger/reports')
export class LedgerReportsController {
  constructor(private readonly reportsService: LedgerReportsService) {}

  @Get('trial-balance')
  @WorkspaceAuth(Permission.LEDGER_VIEW)
  @SchemaResponse(TrialBalanceContract)
  async trialBalance(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(LedgerPeriodQuery) query: LedgerPeriodQuery,
  ): Promise<TrialBalance> {
    assertPeriod(query);
    return this.reportsService.trialBalance(workspaceId, query, query);
  }

  @Get('profit-and-loss')
  @WorkspaceAuth(Permission.LEDGER_VIEW)
  async profitAndLoss(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(LedgerPeriodQuery) query: LedgerPeriodQuery,
  ): Promise<ProfitAndLoss> {
    assertPeriod(query);
    return this.reportsService.profitAndLoss(workspaceId, query, query);
  }

  @Get('balance-sheet')
  @WorkspaceAuth(Permission.LEDGER_VIEW)
  async balanceSheet(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(LedgerDateQuery) query: LedgerDateQuery,
  ): Promise<BalanceSheet> {
    return this.reportsService.balanceSheet(workspaceId, query, query);
  }

  /** The account card: every line in the period with a running balance. */
  @Get('accounts/:id')
  @WorkspaceAuth(Permission.LEDGER_VIEW)
  @SchemaResponse(AccountLedgerContract)
  async accountLedger(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(LedgerRecordParams) { id }: LedgerRecordParams,
    @SchemaQuery(AccountLedgerQuery) query: AccountLedgerQuery,
  ): Promise<AccountLedger> {
    assertPeriod(query);
    return this.reportsService.accountLedger(workspaceId, id, query, query);
  }
}
