import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, type Repository } from 'typeorm';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { BalanceAccount, BalanceAccountKind } from '../../entities/balance-account.entity';
import {
  InvestmentAssetClass,
  InvestmentHolding,
  InvestmentMetal,
  InvestmentPriceSource,
  MetalWeightUnit,
} from '../../entities/investment-holding.entity';
import { MetalSale } from '../../entities/metal-sale.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import {
  WorkspaceServiceSettings,
  WorkspaceServiceSettingsKey,
} from '../../entities/workspace-service-settings.entity';
import { BalanceService } from '../balance/balance.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import type { MetalSettingsDto } from './dto/metal-settings.dto';
import type { SellMetalLotDto } from './dto/sell-metal-lot.dto';
import type { UpsertMetalLotDto } from './dto/upsert-metal-lot.dto';
import { InvestmentsService } from './investments.service';
import { fineTroyOunces } from './metal-weight.util';

const INVESTMENTS_SECTION_CODE = 'ASSET_INVESTMENTS';
const METALS_ACCOUNT_NAME = 'Precious metals';
/** Where lot photos live, under the uploads directory. */
export const PHOTO_DIRECTORY = 'metal-photos';
/** Germany taxes a private sale only inside a year of holding (§ 23 EStG). */
const HOLDING_PERIOD_JURISDICTIONS = new Set(['DE']);

export type DealerDiscounts = Record<InvestmentMetal, number>;

export interface MetalLotView {
  id: string;
  metal: InvestmentMetal;
  name: string;
  /** Pieces in the lot. */
  quantity: number;
  unitWeight: number;
  weightUnit: MetalWeightUnit;
  purity: number;
  /** Fine metal in the lot, troy ounces. */
  fineOunces: number;
  /** Spot price of one fine troy ounce. */
  price: number;
  priceCurrency: string;
  priceSource: InvestmentPriceSource;
  /** The day the price is quoted for, so the UI can say how old it is. */
  pricedAt: Date | null;
  /** Melt value in the workspace currency. */
  value: number;
  acquiredOn: string | null;
  counterparty: string | null;
  /** What was paid, as entered and in the workspace currency. */
  costTotal: number | null;
  costCurrency: string | null;
  cost: number | null;
  /** value − cost; null when the lot has no recorded cost. */
  gain: number | null;
  /** What one fine ounce cost, the number people compare lots by. */
  costPerOunce: number | null;
  /** Paid over the melt value on the day it was bought, and as a share of it. */
  premium: number | null;
  premiumPercent: number | null;
  /** Melt value less what a dealer keeps: what selling would actually bring. */
  dealerValue: number;
  /** Dealer value against cost, in percent; null without a cost. */
  roi: number | null;
  /** Germany only: the day a private sale stops being taxable (§ 23 EStG). */
  taxFreeFrom: string | null;
  /** Where the photo of the lot is served from; null when there is none. */
  photoUrl: string | null;
  storageLocation: string | null;
  /** What it is insured for, as entered and in the workspace currency. */
  insuredValue: number | null;
  insuredCurrency: string | null;
  insured: number | null;
  /** The receipt that proves the purchase, enough of it to recognise. */
  receipt: MetalReceiptView | null;
  /** Whose metal it is; a tax return belongs to a person, not to a workspace. */
  ownerUserId: string | null;
}

/** A purchase receipt as the metals card needs it. */
export interface MetalReceiptView {
  id: string;
  vendor: string | null;
  date: string | null;
  amount: number | null;
  currency: string | null;
}

export interface MetalTotalsView {
  metal: InvestmentMetal;
  fineOunces: number;
  price: number;
  pricedAt: Date | null;
  value: number;
  cost: number;
  gain: number;
  /** Average cost of a fine ounce across the lots still held. */
  costPerOunce: number | null;
  dealerValue: number;
  /** Percent below spot a dealer pays for this metal. */
  dealerDiscount: number;
  /** Result of the sales already made, in the workspace currency. */
  realized: number;
}

export interface MetalSaleView {
  id: string;
  metal: InvestmentMetal;
  lotName: string;
  quantity: number;
  fineOunces: number;
  proceeds: number;
  proceedsCurrency: string;
  costBasis: number | null;
  /** proceeds − cost basis, in the workspace currency. */
  realized: number | null;
  soldOn: string;
  /** The day the sold pieces were bought; null when the lot never said. */
  acquiredOn: string | null;
  counterparty: string | null;
  ownerUserId: string | null;
}

export interface MetalsSummaryView {
  currency: string;
  value: number;
  cost: number;
  gain: number;
  dealerValue: number;
  realized: number;
  /** What the lots are insured for in total; zero when nobody filled it in. */
  insured: number;
  byMetal: MetalTotalsView[];
  lots: MetalLotView[];
  sales: MetalSaleView[];
  dealerDiscount: DealerDiscounts;
  /** The balance-sheet account the lots sit on; null until the first lot. */
  accountId: string | null;
  /** Country the workspace files tax in, so the UI knows whose rules apply. */
  jurisdiction: string | null;
}

/** What a single pass over the lots needs; the rates are memoised per request. */
interface ViewContext {
  currency: string;
  discounts: DealerDiscounts;
  jurisdiction: string | null;
  rates: Map<string, number | null>;
  /** Receipts the lots point at, read once instead of per lot. */
  receipts: Map<string, MetalReceiptView>;
}

/**
 * Physical gold, silver, platinum and palladium. A lot is an
 * `investment_holdings` row of class `metal` whose price is the spot price of
 * one fine troy ounce, so the balance sheet, net worth and the asset-class
 * split read it through the same code path as a share.
 *
 * Spot prices are not fetched here: the metals have ISO 4217 codes, so
 * `ExchangeRatesService` already quotes `XAU→EUR` through its providers and a
 * workspace's hand-entered rate already overrides them.
 */
@Injectable()
export class MetalsService {
  constructor(
    @InjectRepository(BalanceAccount)
    private readonly accountRepository: Repository<BalanceAccount>,
    @InjectRepository(InvestmentHolding)
    private readonly holdingRepository: Repository<InvestmentHolding>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(MetalSale)
    private readonly saleRepository: Repository<MetalSale>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(WorkspaceServiceSettings)
    private readonly settingsRepository: Repository<WorkspaceServiceSettings>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    private readonly balanceService: BalanceService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly investmentsService: InvestmentsService,
  ) {}

  /** Read-only: a workspace that owns no metal gets an empty summary, not an account. */
  async getSummary(workspaceId: string): Promise<MetalsSummaryView> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    const currency = this.currencyOf(workspace);
    const context: ViewContext = {
      currency,
      discounts: await this.dealerDiscounts(workspaceId),
      jurisdiction: workspace?.taxJurisdiction?.code ?? null,
      rates: new Map(),
      receipts: await this.loadReceipts(workspaceId),
    };

    const lots = await this.listLots(workspaceId, context);
    const sales = await this.listSales(workspaceId, context);
    const account = await this.accountRepository.findOne({
      where: { workspaceId, accountKind: BalanceAccountKind.METALS },
      select: ['id'],
    });

    const byMetal = new Map<InvestmentMetal, MetalTotalsView>();
    const totalsFor = (metal: InvestmentMetal): MetalTotalsView => {
      const existing = byMetal.get(metal);
      if (existing) return existing;
      const created: MetalTotalsView = {
        metal,
        fineOunces: 0,
        price: 0,
        pricedAt: null,
        value: 0,
        cost: 0,
        gain: 0,
        costPerOunce: null,
        dealerValue: 0,
        dealerDiscount: context.discounts[metal],
        realized: 0,
      };
      byMetal.set(metal, created);
      return created;
    };

    for (const lot of lots) {
      const totals = totalsFor(lot.metal);
      totals.fineOunces = round8(totals.fineOunces + lot.fineOunces);
      totals.value = round2(totals.value + lot.value);
      totals.cost = round2(totals.cost + (lot.cost ?? 0));
      totals.dealerValue = round2(totals.dealerValue + lot.dealerValue);
      totals.gain = round2(totals.value - totals.cost);
      totals.price = lot.price;
      // The oldest quote wins: a total is only as fresh as its stalest lot.
      if (lot.pricedAt && (!totals.pricedAt || lot.pricedAt < totals.pricedAt)) {
        totals.pricedAt = lot.pricedAt;
      }
    }
    for (const totals of byMetal.values()) {
      totals.costPerOunce =
        totals.fineOunces > 0 && totals.cost > 0 ? round2(totals.cost / totals.fineOunces) : null;
    }
    for (const sale of sales) {
      totalsFor(sale.metal).realized = round2(
        totalsFor(sale.metal).realized + (sale.realized ?? 0),
      );
    }

    const value = round2(lots.reduce((sum, lot) => sum + lot.value, 0));
    const cost = round2(lots.reduce((sum, lot) => sum + (lot.cost ?? 0), 0));
    return {
      currency,
      value,
      cost,
      gain: round2(value - cost),
      dealerValue: round2(lots.reduce((sum, lot) => sum + lot.dealerValue, 0)),
      realized: round2(sales.reduce((sum, sale) => sum + (sale.realized ?? 0), 0)),
      insured: round2(lots.reduce((sum, lot) => sum + (lot.insured ?? 0), 0)),
      byMetal: [...byMetal.values()].sort((a, b) => b.value - a.value),
      lots,
      sales,
      dealerDiscount: context.discounts,
      accountId: account?.id ?? null,
      jurisdiction: context.jurisdiction,
    };
  }

  async addLot(userId: string, workspaceId: string, dto: UpsertMetalLotDto): Promise<MetalLotView> {
    if (!dto.metal) throw new BadRequestException('A lot needs a metal');
    if (!dto.unitWeight || dto.unitWeight <= 0) {
      throw new BadRequestException('A lot needs the weight of one piece');
    }
    const quantity = dto.quantity ?? 1;
    if (quantity <= 0) throw new BadRequestException('A lot needs at least one piece');

    const account = await this.ensureMetalsAccount(workspaceId, userId);
    const currency = await this.workspaceCurrency(workspaceId);
    const weightUnit = dto.weightUnit ?? MetalWeightUnit.TROY_OUNCE;
    const priceCurrency = (dto.priceCurrency ?? currency).toUpperCase();
    const holding = this.holdingRepository.create({
      workspaceId,
      accountId: account.id,
      symbol: null,
      name: dto.name ?? defaultLotName(dto.metal, quantity, dto.unitWeight, weightUnit),
      assetClass: InvestmentAssetClass.METAL,
      metal: dto.metal,
      quantity,
      unitWeight: dto.unitWeight,
      weightUnit,
      purity: dto.purity ?? 1,
      acquiredOn: dto.acquiredOn ? dto.acquiredOn.slice(0, 10) : null,
      costTotal: dto.costTotal ?? null,
      costCurrency:
        dto.costTotal === undefined ? null : (dto.costCurrency ?? currency).toUpperCase(),
      counterparty: dto.counterparty ?? null,
      ownerUserId: dto.ownerUserId ?? userId,
      price: dto.price ?? 0,
      priceCurrency,
      priceSource: InvestmentPriceSource.MANUAL,
      pricedAt: dto.price === undefined ? null : new Date(),
    });
    const saved = await this.holdingRepository.save(holding);
    if (dto.price === undefined) {
      await this.applySpot(saved, workspaceId);
      await this.holdingRepository.save(saved);
    }
    await this.investmentsService.writeSnapshot(userId, workspaceId, account.id);
    return this.lotView(saved, await this.context(workspaceId));
  }

  async updateLot(
    userId: string,
    workspaceId: string,
    lotId: string,
    dto: UpsertMetalLotDto,
  ): Promise<MetalLotView> {
    const lot = await this.requireLot(workspaceId, lotId);
    const currency = await this.workspaceCurrency(workspaceId);
    if (dto.metal !== undefined) lot.metal = dto.metal;
    if (dto.name !== undefined) lot.name = dto.name;
    if (dto.quantity !== undefined) {
      if (dto.quantity <= 0) throw new BadRequestException('A lot needs at least one piece');
      lot.quantity = dto.quantity;
    }
    if (dto.unitWeight !== undefined) {
      if (dto.unitWeight <= 0) throw new BadRequestException('A lot needs the weight of one piece');
      lot.unitWeight = dto.unitWeight;
    }
    if (dto.weightUnit !== undefined) lot.weightUnit = dto.weightUnit;
    if (dto.purity !== undefined) lot.purity = dto.purity;
    if (dto.acquiredOn !== undefined) lot.acquiredOn = dto.acquiredOn.slice(0, 10);
    if (dto.costTotal !== undefined) {
      lot.costTotal = dto.costTotal;
      lot.costCurrency = (dto.costCurrency ?? lot.costCurrency ?? currency).toUpperCase();
    } else if (dto.costCurrency !== undefined) {
      lot.costCurrency = dto.costCurrency.toUpperCase();
    }
    if (dto.counterparty !== undefined) lot.counterparty = dto.counterparty;
    if (dto.storageLocation !== undefined) lot.storageLocation = dto.storageLocation || null;
    if (dto.insuredValue !== undefined) {
      lot.insuredValue = dto.insuredValue;
      lot.insuredCurrency = (dto.insuredCurrency ?? lot.insuredCurrency ?? currency).toUpperCase();
    } else if (dto.insuredCurrency !== undefined) {
      lot.insuredCurrency = dto.insuredCurrency.toUpperCase();
    }
    if (dto.ownerUserId !== undefined) {
      lot.ownerUserId = dto.ownerUserId
        ? await this.requireMemberId(workspaceId, dto.ownerUserId)
        : null;
      // Sales made before anyone said whose metal it was would otherwise stay
      // unattributed with no way to fix them. Only the unanswered ones follow:
      // a sale that already names an owner keeps the one it was given.
      if (lot.ownerUserId) {
        await this.saleRepository.update(
          { workspaceId, lotId: lot.id, ownerUserId: IsNull() },
          { ownerUserId: lot.ownerUserId },
        );
      }
    }
    if (dto.receiptId !== undefined) {
      lot.receiptId = dto.receiptId
        ? await this.requireReceiptId(workspaceId, dto.receiptId)
        : null;
    }
    if (dto.priceCurrency !== undefined) lot.priceCurrency = dto.priceCurrency.toUpperCase();
    if (dto.price !== undefined) {
      lot.price = dto.price;
      lot.priceSource = InvestmentPriceSource.MANUAL;
      lot.pricedAt = new Date();
    } else if (dto.metal !== undefined || dto.priceCurrency !== undefined) {
      // A different metal or currency makes the old quote meaningless.
      await this.applySpot(lot, workspaceId);
    }
    await this.holdingRepository.save(lot);
    await this.investmentsService.writeSnapshot(userId, workspaceId, lot.accountId);
    return this.lotView(lot, await this.context(workspaceId));
  }

  async deleteLot(userId: string, workspaceId: string, lotId: string): Promise<void> {
    const lot = await this.requireLot(workspaceId, lotId);
    const photo = lot.photoFile;
    await this.holdingRepository.remove(lot);
    // The row is gone; its photo would otherwise sit in the uploads directory
    // with nothing left pointing at it.
    await this.deletePhotoFile(photo, null);
    await this.investmentsService.writeSnapshot(userId, workspaceId, lot.accountId);
  }

  /**
   * Sells a lot, whole or in part. The sold pieces take their share of the
   * lot's cost with them, so what stays behind keeps the same cost per ounce
   * and the realized result is recorded once. Selling the last piece removes
   * the lot; the sale survives it. Proceeds of zero are a gift.
   */
  async sellLot(
    userId: string,
    workspaceId: string,
    lotId: string,
    dto: SellMetalLotDto,
  ): Promise<{ sale: MetalSaleView; lot: MetalLotView | null }> {
    const lot = await this.requireLot(workspaceId, lotId);
    const held = Number(lot.quantity);
    const pieces = dto.quantity ?? held;
    if (!(pieces > 0)) throw new BadRequestException('A sale needs at least one piece');
    if (pieces > held) throw new BadRequestException('The lot does not hold that many pieces');

    const currency = await this.workspaceCurrency(workspaceId);
    const share = pieces / held;
    const costTotal = lot.costTotal === null ? null : Number(lot.costTotal);
    const costBasis = costTotal === null ? null : round6(costTotal * share);
    const sale = await this.saleRepository.save(
      this.saleRepository.create({
        workspaceId,
        lotId: lot.id,
        metal: lot.metal as InvestmentMetal,
        lotName: lot.name,
        quantity: pieces,
        fineOunces: round8(fineTroyOunces(lot) * share),
        proceeds: dto.proceeds ?? 0,
        proceedsCurrency: (dto.proceedsCurrency ?? currency).toUpperCase(),
        costBasis,
        costCurrency: lot.costCurrency,
        soldOn: (dto.soldOn ?? new Date().toISOString()).slice(0, 10),
        // Copied, not referenced: selling the last piece deletes the lot.
        acquiredOn: lot.acquiredOn ? String(lot.acquiredOn).slice(0, 10) : null,
        counterparty: dto.counterparty ?? null,
        ownerUserId: lot.ownerUserId,
      }),
    );

    const accountId = lot.accountId;
    const remaining = round8(held - pieces);
    let left: InvestmentHolding | null = null;
    if (remaining > 0) {
      lot.quantity = remaining;
      lot.costTotal =
        costTotal === null || costBasis === null ? null : round6(costTotal - costBasis);
      left = await this.holdingRepository.save(lot);
    } else {
      const photo = lot.photoFile;
      await this.holdingRepository.remove(lot);
      await this.deletePhotoFile(photo, null);
    }
    await this.investmentsService.writeSnapshot(userId, workspaceId, accountId);

    const context = await this.context(workspaceId);
    return {
      sale: await this.saleView(sale, context),
      lot: left ? await this.lotView(left, context) : null,
    };
  }

  /**
   * Re-quotes every lot whose price was not hand-entered and rewrites the
   * account's snapshot. Returns how many lots got a price.
   */
  async refreshPrices(userId: string, workspaceId: string): Promise<number> {
    const lots = await this.holdingRepository.find({
      where: { workspaceId, metal: Not(IsNull()) },
    });
    let updated = 0;
    const touched = new Set<string>();
    for (const lot of lots) {
      if (lot.priceSource === InvestmentPriceSource.MANUAL && Number(lot.price) > 0) continue;
      if (!(await this.applySpot(lot, workspaceId))) continue;
      await this.holdingRepository.save(lot);
      touched.add(lot.accountId);
      updated += 1;
    }
    for (const accountId of touched) {
      await this.investmentsService.writeSnapshot(userId, workspaceId, accountId);
    }
    return updated;
  }

  /** What a dealer keeps below spot, per metal. */
  async dealerDiscounts(workspaceId: string): Promise<DealerDiscounts> {
    const row = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.METALS },
    });
    const stored = (row?.config?.dealerDiscount ?? {}) as Record<string, unknown>;
    const discounts = {} as DealerDiscounts;
    for (const metal of Object.values(InvestmentMetal)) {
      const value = Number(stored[metal]);
      discounts[metal] = Number.isFinite(value) && value > 0 ? Math.min(value, 90) : 0;
    }
    return discounts;
  }

  async saveSettings(
    userId: string,
    workspaceId: string,
    dto: MetalSettingsDto,
  ): Promise<DealerDiscounts> {
    const current = await this.dealerDiscounts(workspaceId);
    const next = { ...current, ...(dto.dealerDiscount ?? {}) };
    const row =
      (await this.settingsRepository.findOne({
        where: { workspaceId, key: WorkspaceServiceSettingsKey.METALS },
      })) ??
      this.settingsRepository.create({
        workspaceId,
        key: WorkspaceServiceSettingsKey.METALS,
        config: {},
        encryptedSecrets: {},
      });
    row.config = { ...row.config, dealerDiscount: next };
    row.updatedByUserId = userId;
    await this.settingsRepository.save(row);
    return this.dealerDiscounts(workspaceId);
  }

  private async context(workspaceId: string): Promise<ViewContext> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    return {
      currency: this.currencyOf(workspace),
      discounts: await this.dealerDiscounts(workspaceId),
      jurisdiction: workspace?.taxJurisdiction?.code ?? null,
      rates: new Map(),
      receipts: await this.loadReceipts(workspaceId),
    };
  }

  private async listLots(workspaceId: string, context: ViewContext): Promise<MetalLotView[]> {
    const lots = await this.holdingRepository.find({
      where: { workspaceId, metal: Not(IsNull()) },
      order: { acquiredOn: 'DESC', createdAt: 'DESC' },
    });
    const views: MetalLotView[] = [];
    for (const lot of lots) {
      views.push(await this.lotView(lot, context));
    }
    return views;
  }

  private async listSales(workspaceId: string, context: ViewContext): Promise<MetalSaleView[]> {
    const sales = await this.saleRepository.find({
      where: { workspaceId },
      order: { soldOn: 'DESC', createdAt: 'DESC' },
    });
    const views: MetalSaleView[] = [];
    for (const sale of sales) {
      views.push(await this.saleView(sale, context));
    }
    return views;
  }

  /** Writes today's spot price onto the lot. False when no quote could be found. */
  private async applySpot(lot: InvestmentHolding, workspaceId: string): Promise<boolean> {
    if (!lot.metal) return false;
    const quote = await this.exchangeRatesService.getRateQuote(
      lot.metal,
      lot.priceCurrency,
      undefined,
      { workspaceId },
    );
    if (!quote || !(quote.rate > 0)) return false;
    lot.price = quote.rate;
    lot.priceSource = InvestmentPriceSource.AUTO;
    lot.pricedAt = new Date(`${quote.rateDate}T00:00:00.000Z`);
    return true;
  }

  private async lotView(lot: InvestmentHolding, context: ViewContext): Promise<MetalLotView> {
    const { currency } = context;
    const metal = lot.metal as InvestmentMetal;
    const fineOunces = fineTroyOunces(lot);
    const acquiredOn = lot.acquiredOn ? String(lot.acquiredOn).slice(0, 10) : null;
    const price = Number(lot.price);
    const value = round2(
      await this.convert(fineOunces * price, lot.priceCurrency, currency, lot.workspaceId),
    );
    const cost =
      lot.costTotal === null
        ? null
        : round2(
            await this.convert(
              Number(lot.costTotal),
              lot.costCurrency ?? currency,
              currency,
              lot.workspaceId,
              acquiredOn,
            ),
          );
    const discount = context.discounts[metal] ?? 0;
    const premium = await this.premiumAtPurchase(lot, cost, fineOunces, acquiredOn, context);
    const dealerValue = round2(value * (1 - discount / 100));
    return {
      id: lot.id,
      metal,
      name: lot.name,
      quantity: Number(lot.quantity),
      unitWeight: Number(lot.unitWeight ?? 0),
      weightUnit: lot.weightUnit ?? MetalWeightUnit.TROY_OUNCE,
      purity: Number(lot.purity ?? 1),
      fineOunces: round8(fineOunces),
      price,
      priceCurrency: lot.priceCurrency,
      priceSource: lot.priceSource,
      pricedAt: lot.pricedAt,
      value,
      acquiredOn,
      counterparty: lot.counterparty,
      costTotal: lot.costTotal === null ? null : Number(lot.costTotal),
      costCurrency: lot.costCurrency,
      cost,
      gain: cost === null ? null : round2(value - cost),
      costPerOunce: cost !== null && fineOunces > 0 ? round2(cost / fineOunces) : null,
      premium: premium?.amount ?? null,
      premiumPercent: premium?.percent ?? null,
      dealerValue,
      roi: cost !== null && cost > 0 ? round2((dealerValue / cost - 1) * 100) : null,
      taxFreeFrom:
        acquiredOn && context.jurisdiction && HOLDING_PERIOD_JURISDICTIONS.has(context.jurisdiction)
          ? oneYearOn(acquiredOn)
          : null,
      photoUrl: lot.photoFile ? `/uploads/${PHOTO_DIRECTORY}/${lot.photoFile}` : null,
      storageLocation: lot.storageLocation,
      insuredValue: lot.insuredValue === null ? null : Number(lot.insuredValue),
      insuredCurrency: lot.insuredCurrency,
      insured:
        lot.insuredValue === null
          ? null
          : round2(
              await this.convert(
                Number(lot.insuredValue),
                lot.insuredCurrency ?? currency,
                currency,
                lot.workspaceId,
              ),
            ),
      receipt: lot.receiptId ? (context.receipts.get(lot.receiptId) ?? null) : null,
      ownerUserId: lot.ownerUserId,
    };
  }

  /**
   * What the lot cost over its melt value on the day it was bought — the
   * premium a dealer charged. Without a purchase day or a rate for it there is
   * no honest answer, so there is none.
   */
  private async premiumAtPurchase(
    lot: InvestmentHolding,
    cost: number | null,
    fineOunces: number,
    acquiredOn: string | null,
    context: ViewContext,
  ): Promise<{ amount: number; percent: number | null } | null> {
    if (cost === null || !acquiredOn || !lot.metal || fineOunces <= 0) return null;
    const spot = await this.rateOn(
      lot.metal,
      context.currency,
      acquiredOn,
      lot.workspaceId,
      context,
    );
    if (spot === null) return null;
    const melt = fineOunces * spot;
    if (!(melt > 0)) return null;
    return { amount: round2(cost - melt), percent: round2(((cost - melt) / melt) * 100) };
  }

  /** A dated rate, asked for once per metal, currency and day. */
  private async rateOn(
    metal: InvestmentMetal,
    currency: string,
    date: string,
    workspaceId: string,
    context: ViewContext,
  ): Promise<number | null> {
    const key = `${metal}:${currency}:${date}`;
    const cached = context.rates.get(key);
    if (cached !== undefined) return cached;
    const quote = await this.exchangeRatesService.getRateQuote(metal, currency, date, {
      workspaceId,
    });
    const rate = quote && quote.rate > 0 ? quote.rate : null;
    context.rates.set(key, rate);
    return rate;
  }

  private async saleView(sale: MetalSale, context: ViewContext): Promise<MetalSaleView> {
    const { currency } = context;
    const soldOn = String(sale.soldOn).slice(0, 10);
    const acquiredOn = sale.acquiredOn ? String(sale.acquiredOn).slice(0, 10) : null;
    const proceeds = round2(
      await this.convert(
        Number(sale.proceeds),
        sale.proceedsCurrency,
        currency,
        sale.workspaceId,
        soldOn,
      ),
    );
    const costBasis =
      sale.costBasis === null
        ? null
        : round2(
            await this.convert(
              Number(sale.costBasis),
              sale.costCurrency ?? currency,
              currency,
              sale.workspaceId,
              acquiredOn ?? soldOn,
            ),
          );
    return {
      id: sale.id,
      metal: sale.metal,
      lotName: sale.lotName,
      quantity: Number(sale.quantity),
      fineOunces: Number(sale.fineOunces),
      proceeds,
      proceedsCurrency: sale.proceedsCurrency,
      costBasis,
      realized: costBasis === null ? null : round2(proceeds - costBasis),
      soldOn,
      acquiredOn,
      counterparty: sale.counterparty,
      ownerUserId: sale.ownerUserId,
    };
  }

  /**
   * Attaches an uploaded photo to the lot and removes the one it replaces:
   * an orphaned file in the uploads directory is a leak nobody notices.
   */
  async setPhoto(workspaceId: string, lotId: string, fileName: string): Promise<MetalLotView> {
    const lot = await this.requireLot(workspaceId, lotId);
    const replaced = lot.photoFile;
    lot.photoFile = fileName;
    await this.holdingRepository.save(lot);
    await this.deletePhotoFile(replaced, fileName);
    return this.lotView(lot, await this.context(workspaceId));
  }

  async removePhoto(workspaceId: string, lotId: string): Promise<MetalLotView> {
    const lot = await this.requireLot(workspaceId, lotId);
    const removed = lot.photoFile;
    lot.photoFile = null;
    await this.holdingRepository.save(lot);
    await this.deletePhotoFile(removed, null);
    return this.lotView(lot, await this.context(workspaceId));
  }

  /** Receipts a lot may point at: the workspace's own, newest first. */
  async listReceiptOptions(workspaceId: string, limit = 50): Promise<MetalReceiptView[]> {
    const receipts = await this.receiptRepository.find({
      where: { workspaceId },
      order: { receivedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return receipts.map(receipt => receiptView(receipt));
  }

  private async loadReceipts(workspaceId: string): Promise<Map<string, MetalReceiptView>> {
    const lots = await this.holdingRepository.find({
      where: { workspaceId, metal: Not(IsNull()), receiptId: Not(IsNull()) },
      select: ['receiptId'],
    });
    const ids = [...new Set(lots.map(lot => lot.receiptId as string))];
    if (ids.length === 0) return new Map();
    const receipts = await this.receiptRepository.find({ where: { workspaceId, id: In(ids) } });
    return new Map(receipts.map(receipt => [receipt.id, receiptView(receipt)]));
  }

  /** A receipt id is only accepted when it belongs to this workspace. */
  private async requireReceiptId(workspaceId: string, receiptId: string): Promise<string> {
    const receipt = await this.receiptRepository.findOne({
      where: { id: receiptId, workspaceId },
      select: ['id'],
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt.id;
  }

  /** An owner is only accepted when they are a member of this workspace. */
  private async requireMemberId(workspaceId: string, userId: string): Promise<string> {
    const member = await this.memberRepository.findOne({
      where: { workspaceId, userId },
      select: ['id'],
    });
    if (!member) throw new NotFoundException('Workspace member not found');
    return userId;
  }

  private async deletePhotoFile(fileName: string | null, keep: string | null): Promise<void> {
    if (!fileName || fileName === keep) return;
    try {
      await fs.unlink(path.join(resolveUploadsDir(), PHOTO_DIRECTORY, path.basename(fileName)));
    } catch {
      // Already gone, or never written: nothing left to clean up.
    }
  }

  /**
   * The workspace's metals account, created on first lot. Public because the
   * import creates the account before its transaction opens: this service
   * writes through its own repositories and must not join that transaction.
   */
  async ensureMetalsAccount(workspaceId: string, userId: string): Promise<BalanceAccount> {
    const existing = await this.accountRepository.findOne({
      where: { workspaceId, accountKind: BalanceAccountKind.METALS },
    });
    if (existing) return existing;

    await this.balanceService.seedDefaultAccounts(workspaceId);
    const section = await this.accountRepository.findOne({
      where: { workspaceId, code: INVESTMENTS_SECTION_CODE },
    });
    if (!section) throw new NotFoundException('Investments section not found');
    const created = await this.balanceService.createCustomAccount(userId, workspaceId, {
      name: METALS_ACCOUNT_NAME,
      nameEn: METALS_ACCOUNT_NAME,
      parentId: section.id,
    });
    await this.accountRepository.update(
      { id: created.id, workspaceId },
      { accountKind: BalanceAccountKind.METALS },
    );
    return this.accountRepository.findOneByOrFail({ id: created.id });
  }

  private async requireLot(workspaceId: string, lotId: string): Promise<InvestmentHolding> {
    const lot = await this.holdingRepository.findOne({
      where: { id: lotId, workspaceId, metal: Not(IsNull()) },
    });
    if (!lot) throw new NotFoundException('Metal lot not found');
    return lot;
  }

  private async workspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['currency'],
    });
    return this.currencyOf(workspace);
  }

  private currencyOf(workspace: Workspace | null): string {
    const normalized = String(workspace?.currency || '')
      .trim()
      .toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : 'KZT';
  }

  /**
   * Converts at the rate of `on`, not of today: what a lot cost in March is a
   * March amount, and a sale made then fetched what it fetched then. Today's
   * rate belongs only to what is worth something today.
   */
  private async convert(
    amount: number,
    from: string,
    to: string,
    workspaceId: string,
    on?: string | null,
  ): Promise<number> {
    if (!Number.isFinite(amount) || amount === 0) return 0;
    const source = (from || to).toUpperCase();
    if (source === to) return amount;
    const rate = await this.exchangeRatesService.getRateOrNull(
      source,
      to,
      on ?? undefined,
      workspaceId,
    );
    return rate === null ? 0 : amount * rate;
  }
}

function receiptView(receipt: Receipt): MetalReceiptView {
  const parsed = receipt.parsedData ?? {};
  return {
    id: receipt.id,
    vendor: parsed.vendor ?? receipt.subject ?? null,
    date:
      parsed.date ?? (receipt.receivedAt ? receipt.receivedAt.toISOString().slice(0, 10) : null),
    amount: parsed.amount ?? null,
    currency: parsed.currency ?? null,
  };
}

function defaultLotName(
  metal: InvestmentMetal,
  quantity: number,
  unitWeight: number,
  unit: MetalWeightUnit,
): string {
  return `${quantity} × ${unitWeight} ${unit} ${metal}`;
}

/** The same day a year on; 29 February lands on 1 March, as the calendar does. */
function oneYearOn(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCFullYear(parsed.getUTCFullYear() + 1);
  return parsed.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function round8(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}
