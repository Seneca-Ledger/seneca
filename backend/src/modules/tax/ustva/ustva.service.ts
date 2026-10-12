import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Not, Repository } from 'typeorm';
import { countedWhere } from '../../../common/utils/counted-transactions.util';
import { TaxFilingPeriod } from '../../../entities/tax-jurisdiction.entity';
import { Transaction, TransactionType } from '../../../entities/transaction.entity';
import { VatStatus, Workspace } from '../../../entities/workspace.entity';
import { ExchangeRatesService } from '../../exchange-rates/exchange-rates.service';
import { toDateOnly } from '../jurisdictions.service';
import { WorkspaceTaxSettingsService } from '../workspace-tax-settings.service';
import { buildUstva, type SupplyType, type UstvaForm, type UstvaRow } from './ustva-form';

export type UstvaUnsupportedReason =
  | 'not_germany'
  | 'not_registered'
  | 'form_year_unknown'
  | 'period_spans_years';

export interface UstvaResult {
  /** NULL when the form can be filled; otherwise why not. */
  unsupported: UstvaUnsupportedReason | null;
  form: UstvaForm | null;
  /** Rows left out for want of an exchange rate; the form is incomplete while any are. */
  missingRates: Array<{ transactionId: string; date: string; currency: string }>;
  /**
   * The last monthly return of the year under a standing extension: the
   * Sondervorauszahlung paid in February is deducted on line 49 (Kz 39),
   * which Lumio does not know.
   */
  sondervorauszahlungDue: boolean;
}

/**
 * Reads a period's assessed transactions into the German VAT advance return
 * (see ustva-form.ts). Uses the same rows as the VAT return — counted, not a
 * transfer between own accounts, assessed at a rate — and converts each at
 * its own date's rate, as the return does.
 */
@Injectable()
export class UstvaService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly taxSettingsService: WorkspaceTaxSettingsService,
  ) {}

  async build(workspaceId: string, periodStart: string, periodEnd: string): Promise<UstvaResult> {
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (!(day.test(periodStart) && day.test(periodEnd))) {
      throw new BadRequestException('periodStart and periodEnd must be YYYY-MM-DD');
    }
    const result = (unsupported: UstvaUnsupportedReason): UstvaResult => ({
      unsupported,
      form: null,
      missingRates: [],
      sondervorauszahlungDue: false,
    });

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    if (workspace?.taxJurisdiction?.code !== 'DE') {
      return result('not_germany');
    }
    if (workspace.vatStatus !== VatStatus.REGISTERED) {
      return result('not_registered');
    }
    const year = Number(periodStart.slice(0, 4));
    if (Number(periodEnd.slice(0, 4)) !== year) {
      return result('period_spans_years');
    }

    const { rows, missingRates } = await this.rowsOf(workspaceId, periodStart, periodEnd);
    const form = buildUstva(year, rows);
    if (!form) {
      return result('form_year_unknown');
    }

    const filing = await this.taxSettingsService.getVatFiling(workspaceId);
    return {
      unsupported: null,
      form,
      missingRates,
      sondervorauszahlungDue:
        filing.extension &&
        filing.frequency === TaxFilingPeriod.MONTHLY &&
        periodEnd.slice(5, 7) === '12',
    };
  }

  private async rowsOf(workspaceId: string, periodStart: string, periodEnd: string) {
    const transactions = await this.transactionRepository.find({
      where: countedWhere({
        workspaceId,
        transferPairId: IsNull(),
        transactionDate: Between(new Date(periodStart), new Date(periodEnd)),
        taxRateId: Not(IsNull()),
      }),
      relations: { taxRate: true },
      order: { transactionDate: 'ASC' },
    });

    const payeeIds = [...new Set(transactions.map(row => row.payeeId).filter(Boolean))];
    const payees: Array<{ id: string; name: string; supply_type: SupplyType | null }> =
      payeeIds.length > 0
        ? await this.transactionRepository.manager.query(
            'SELECT id, name, supply_type FROM payees WHERE workspace_id = $1 AND id = ANY($2)',
            [workspaceId, payeeIds],
          )
        : [];
    const payeeOf = new Map(payees.map(payee => [payee.id, payee]));

    const rows: UstvaRow[] = [];
    const missingRates: UstvaResult['missingRates'] = [];
    for (const transaction of transactions) {
      const currency = (transaction.currency || 'EUR').toUpperCase();
      const rate = await this.rateToEuro(currency, transaction, workspaceId);
      if (rate === null) {
        missingRates.push({
          transactionId: transaction.id,
          date: toDateOnly(transaction.transactionDate),
          currency,
        });
        continue;
      }
      rows.push(rowOf(transaction, rate, payeeOf.get(transaction.payeeId ?? '')));
    }
    return { rows, missingRates };
  }

  /** Never `getRate`: it answers 1 when it has no rate. */
  private rateToEuro(
    currency: string,
    transaction: Transaction,
    workspaceId: string,
  ): Promise<number | null> {
    if (currency === 'EUR') {
      return Promise.resolve(1);
    }
    return this.exchangeRatesService.getRateOrNull(
      currency,
      'EUR',
      new Date(transaction.transactionDate),
      workspaceId,
    );
  }
}

/** One assessed transaction in euros; the notional tax under reverse charge. */
function rowOf(
  transaction: Transaction,
  rate: number,
  payee: { id: string; name: string; supply_type: SupplyType | null } | undefined,
): UstvaRow {
  const reverseCharge = transaction.taxReverseCharge === true;
  const tax = Number((reverseCharge ? transaction.taxNotionalAmount : transaction.taxAmount) ?? 0);
  return {
    transactionId: transaction.id,
    direction: transaction.transactionType === TransactionType.INCOME ? 'income' : 'expense',
    reverseCharge,
    ratePercent: Number(transaction.taxRate?.rate ?? 0),
    net: Math.round(Number(transaction.taxNetAmount ?? 0) * rate * 100) / 100,
    tax: Math.round(tax * rate * 100) / 100,
    payeeId: payee?.id ?? null,
    payeeName: payee?.name ?? null,
    supplyType: payee?.supply_type ?? null,
  };
}
