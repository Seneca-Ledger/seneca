import { Controller, Get, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  BulkConvertBody,
  ExchangeRateCoverage,
  ExchangeRateQuery,
  ExchangeRateQuote,
  ManualRateBody,
} from '../../contracts';
import { Workspace } from '../../entities/workspace.entity';
import { ExchangeRatesService } from './exchange-rates.service';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(
    private readonly exchangeRatesService: ExchangeRatesService,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  /**
   * The rate, or `missing: true` with rate 1 when none exists — never a silent 1.
   * The workspace's hand-entered rates count.
   */
  @Get()
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(ExchangeRateQuote)
  async getRate(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(ExchangeRateQuery) { from, to, date }: ExchangeRateQuery,
  ) {
    const rateDate = date ? new Date(date) : undefined;
    const quote = await this.exchangeRatesService.getRateQuote(from, to, rateDate, { workspaceId });
    return {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate: quote?.rate ?? 1,
      date: date ?? null,
      rateDate: quote?.rateDate ?? null,
      stale: quote?.stale ?? false,
      missing: quote === null,
    };
  }

  /** Every currency in this workspace's rows and whether a rate to the workspace currency exists. */
  @Get('coverage')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(ExchangeRateCoverage)
  async coverage(@WorkspaceId() workspaceId: string) {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: {
        currency: true,
      },
    });
    const currency = (workspace?.currency || 'KZT').toUpperCase();
    const currencies = await this.exchangeRatesService.coverageForWorkspace(workspaceId, currency);
    return {
      currency,
      currencies,
      missing: currencies.filter(item => item.rate === null).map(item => item.currency),
    };
  }

  /** A rate entered by hand for one day; wins over the provider for that day, in this workspace. */
  @Post('manual')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async setManual(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(ManualRateBody) dto: ManualRateBody,
  ) {
    return this.exchangeRatesService.setManualRate(
      workspaceId,
      dto.from,
      dto.to,
      dto.rate,
      dto.date ?? undefined,
    );
  }

  @Post('convert')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async bulkConvert(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(BulkConvertBody) dto: BulkConvertBody,
  ) {
    const items = dto.items.map(item => ({
      amount: item.amount,
      currency: item.currency,
      date: item.date ? new Date(item.date) : undefined,
    }));
    const results = await this.exchangeRatesService.bulkConvert(
      items,
      dto.targetCurrency,
      workspaceId,
    );
    return { targetCurrency: dto.targetCurrency, results };
  }
}
