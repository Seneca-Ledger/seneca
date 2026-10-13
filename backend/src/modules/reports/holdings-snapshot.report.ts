import { Injectable } from '@nestjs/common';
import { CryptoHoldingsService } from '../crypto/crypto-holdings.service';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { InvestmentsService } from '../investments/investments.service';
import { MetalsService } from '../investments/metals.service';
import type { ReportCell, ReportDocument } from './report-document.util';
import { fillLabel } from './report-template.translations';
import type { TemplateLabels } from './report-template.types';

/** A quote older than this is called out: automatic stock prices may have stopped updating. */
const STALE_PRICE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Everything the workspace holds, priced today: securities and funds, metal
 * lots and crypto, each in its own section, with one total.
 *
 * Positions have no history, so this is a snapshot at generation time and the
 * report period does not apply. Values are converted here, through one
 * CurrencyConverter, rather than taken pre-converted from the three services:
 * those quietly turn a missing rate into 0 or into 1:1, and a holdings list
 * handed to a lawyer or an accountant must say when an amount is left out.
 */
@Injectable()
export class HoldingsSnapshotReport {
  constructor(
    private readonly investmentsService: InvestmentsService,
    private readonly metalsService: MetalsService,
    private readonly cryptoHoldingsService: CryptoHoldingsService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async build(
    workspaceId: string,
    text: TemplateLabels,
    currency: string,
    now = new Date(),
  ): Promise<{ document: ReportDocument; missingRates: string[] }> {
    const today = now.toISOString().slice(0, 10);
    const [accounts, metals, crypto] = await Promise.all([
      this.investmentsService.listAccounts(workspaceId),
      this.metalsService.getSummary(workspaceId),
      // Asked in USD, the currency its prices come in, and converted below.
      this.cryptoHoldingsService.getHoldings(workspaceId, 'USD'),
    ]);

    const holdings = accounts.flatMap(account =>
      account.holdings.map(holding => ({ account, holding })),
    );
    const converter = await CurrencyConverter.load(
      this.exchangeRatesService,
      currency,
      [
        ...holdings.map(({ holding }) => normalizeCurrencyCode(holding.priceCurrency)),
        ...metals.lots.map(lot => normalizeCurrencyCode(lot.priceCurrency)),
        ...(crypto.holdings.length ? ['USD'] : []),
      ].map(code => ({ currency: code, date: today })),
      workspaceId,
    );
    const toCurrency = (amount: number, code: string): number =>
      converter.convert(amount, normalizeCurrencyCode(code), today);

    let stale = 0;
    const isStale = (pricedAt: unknown): boolean => {
      const old =
        pricedAt !== null &&
        pricedAt !== undefined &&
        now.getTime() - new Date(pricedAt as string).getTime() > STALE_PRICE_DAYS * DAY_MS;
      stale += old ? 1 : 0;
      return old;
    };

    const accountValue = new Map<string, number>();
    const securityRows: ReportCell[][] = holdings.map(({ account, holding }) => {
      const value = toCurrency(holding.quantity * holding.price, holding.priceCurrency);
      accountValue.set(account.id, (accountValue.get(account.id) ?? 0) + value);
      isStale(holding.pricedAt);
      return [
        account.name,
        holding.symbol ?? '',
        holding.name,
        this.assetClassLabel(holding.assetClass, text),
        holding.quantity,
        holding.price,
        holding.priceCurrency,
        holding.pricedAt ? new Date(holding.pricedAt as string).toISOString().slice(0, 10) : '',
        holding.priceSource === 'auto' ? text.priceAuto : text.priceManual,
        round2(value),
      ];
    });
    const securitiesTotal = Array.from(accountValue.values()).reduce((sum, v) => sum + v, 0);
    const accountRows: ReportCell[][] = accounts.map(account => {
      const value = accountValue.get(account.id) ?? 0;
      return [
        account.name,
        round2(value),
        round2(account.contributed),
        round2(value - account.contributed),
      ];
    });

    let metalsTotal = 0;
    const metalRows: ReportCell[][] = metals.lots.map(lot => {
      const value = toCurrency(lot.fineOunces * lot.price, lot.priceCurrency);
      metalsTotal += value;
      isStale(lot.pricedAt);
      return [
        lot.metal,
        lot.name,
        `${lot.quantity} × ${lot.unitWeight} ${lot.weightUnit}`,
        lot.purity,
        round2(lot.fineOunces * 1000) / 1000,
        round2(value),
        lot.cost === null ? '' : round2(lot.cost),
        lot.cost === null ? '' : round2(value - lot.cost),
        lot.storageLocation ?? '',
      ];
    });

    let cryptoTotal = 0;
    const cryptoRows: ReportCell[][] = crypto.holdings.map(holding => {
      const value = toCurrency(holding.value, 'USD');
      const cost = holding.cost === null ? null : toCurrency(holding.cost, 'USD');
      cryptoTotal += value;
      return [
        holding.asset,
        holding.amount,
        round2(toCurrency(holding.price, 'USD')),
        round2(value),
        holding.avgCost === null ? '' : round2(toCurrency(holding.avgCost, 'USD')),
        cost === null ? '' : round2(cost),
        cost === null ? '' : round2(value - cost),
        holding.basisIncomplete ? text.basisIncomplete : '',
      ];
    });

    const notes = [
      ...(stale ? [fillLabel(text.stalePriceNote, { count: stale, days: STALE_PRICE_DAYS })] : []),
      ...(crypto.unpriced.length
        ? [
            fillLabel(text.unpricedNote, {
              assets: crypto.unpriced.map(item => `${item.amount} ${item.asset}`).join(', '),
            }),
          ]
        : []),
    ];
    const valueColumn = fillLabel(text.valueInCurrency, { currency });

    const document: ReportDocument = {
      title: text.titleInvestmentHoldings,
      subtitle: fillLabel(text.subtitleAsOf, { date: today, currency }),
      orientation: 'landscape',
      ...(notes.length ? { notes } : {}),
      sections: [
        {
          title: text.securities,
          columns: [
            text.account,
            text.ticker,
            text.name,
            text.assetClass,
            text.quantity,
            text.price,
            text.priceCurrency,
            text.pricedOn,
            text.priceSource,
            valueColumn,
          ],
          rows: securityRows,
          total: [text.total, '', '', '', '', '', '', '', '', round2(securitiesTotal)],
        },
        {
          title: text.investmentAccounts,
          columns: [text.account, valueColumn, text.contributed, text.gain],
          rows: accountRows,
        },
        {
          title: text.metals,
          columns: [
            text.metal,
            text.name,
            text.weight,
            text.purity,
            text.fineOunces,
            valueColumn,
            text.cost,
            text.unrealizedGain,
            text.storage,
          ],
          rows: metalRows,
          total: [text.total, '', '', '', '', round2(metalsTotal), '', '', ''],
        },
        {
          title: text.crypto,
          columns: [
            text.asset,
            text.quantity,
            text.price,
            valueColumn,
            text.averageCost,
            text.cost,
            text.unrealizedGain,
            '',
          ],
          rows: cryptoRows,
          total: [text.total, '', '', round2(cryptoTotal), '', '', '', ''],
        },
      ],
      footer: [[text.totalPortfolio, round2(securitiesTotal + metalsTotal + cryptoTotal)]],
    };

    return { document, missingRates: converter.missing };
  }

  private assetClassLabel(assetClass: string, text: TemplateLabels): string {
    const labels: Record<string, string> = {
      stock: text.assetStock,
      etf: text.assetEtf,
      fund: text.assetFund,
      bond: text.assetBond,
      cash: text.assetCash,
      real_estate: text.assetRealEstate,
      metal: text.assetMetal,
    };
    return labels[assetClass] ?? text.assetOther;
  }
}
