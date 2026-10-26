import { Injectable } from '@nestjs/common';
import { appDefaultCurrency } from '../../common/utils/currency.util';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import {
  addAmount,
  type CurrencyAmounts,
  CurrencyConverter,
  normalizeCurrencyCode,
} from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { CustomTablesService } from './custom-tables.service';

export interface CustomTableMoneyTotal {
  /** The money column that was summed; null when the table has none. */
  column: string | null;
  currency: string;
  total: number | null;
  /** Currencies left out of the total for want of a rate, sorted. */
  missing: string[];
}

const sourceField = (column: CustomTableColumn): unknown =>
  (column.config?.source as { field?: unknown } | undefined)?.field;

/**
 * One figure for the whole table, like an account balance: the first money
 * column summed over every row, in the workspace currency.
 *
 * Rows of one table can be in different currencies (a transactions table
 * keeps each row's code in its Currency column), so the column is summed per
 * code and converted at today's rate. A code without a rate is listed in
 * `missing` rather than counted 1:1.
 */
@Injectable()
export class CustomTableMoneyTotalService {
  constructor(
    private readonly customTablesService: CustomTablesService,
    private readonly exchangeRates: ExchangeRatesService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
  ) {}

  async getTotal(workspaceId: string, tableId: string): Promise<CustomTableMoneyTotal> {
    const table = await this.customTablesService.getTable(workspaceId, tableId);
    const target = normalizeCurrencyCode(
      (await this.workspaceCurrency.resolve(workspaceId)) ?? appDefaultCurrency(),
    );
    const money = table.columns.find(c => c.type === CustomTableColumnType.CURRENCY);
    if (!money) {
      return { column: null, currency: target, total: null, missing: [] };
    }
    const columnCurrency =
      normalizeCurrencyCode(
        typeof money.config?.currency === 'string' ? money.config.currency : '',
      ) || target;
    const codes = table.columns.find(
      c => c.type === CustomTableColumnType.TEXT && sourceField(c) === 'currency',
    );

    const amounts: CurrencyAmounts = new Map();
    const sum = { col: money.key, fn: 'sum' as const };
    if (codes) {
      const { items } = await this.customTablesService.groupRows(workspaceId, tableId, {
        groupBy: codes.key,
        aggs: [sum],
        limit: 1000,
      });
      for (const group of items) {
        // A row without a code is in the column's own currency.
        const currency = normalizeCurrencyCode(group.key) || columnCurrency;
        addAmount(amounts, currency, Number(group.aggregates[0]?.value ?? 0) || 0);
      }
    } else {
      const { items } = await this.customTablesService.aggregateRows(workspaceId, tableId, {
        aggs: [sum],
      });
      addAmount(amounts, columnCurrency, Number(items[0]?.value ?? 0) || 0);
    }

    const today = new Date().toISOString().slice(0, 10);
    const converter = await CurrencyConverter.load(
      this.exchangeRates,
      target,
      [...amounts.keys()].map(currency => ({ currency, date: today })),
      workspaceId,
    );
    const total = converter.convertAll(amounts, today);
    return {
      column: money.key,
      currency: target,
      total: Math.round(total * 100) / 100,
      missing: converter.missing,
    };
  }
}
