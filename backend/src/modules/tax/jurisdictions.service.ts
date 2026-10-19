import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { TaxJurisdiction } from '../../entities/tax-jurisdiction.entity';
import { TaxJurisdictionRate } from '../../entities/tax-jurisdiction-rate.entity';

/**
 * `Date` -> 'YYYY-MM-DD', which is how `date` columns compare in Postgres.
 *
 * A `Date` is read in UTC, so passing `new Date()` means "today in UTC", which
 * is a day behind for a user east of UTC in the small hours. Callers that care
 * which calendar day a document belongs to must pass the date explicitly rather
 * than relying on the server's idea of now — every endpoint here accepts one.
 */
export function toDateOnly(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

/**
 * Read-only access to the global jurisdiction catalogue.
 *
 * There is no create/update/delete here on purpose: these rows are law, and
 * they change only by migration.
 */
@Injectable()
export class JurisdictionsService {
  constructor(
    @InjectRepository(TaxJurisdiction)
    private readonly jurisdictionRepository: Repository<TaxJurisdiction>,
    @InjectRepository(TaxJurisdictionRate)
    private readonly rateRepository: Repository<TaxJurisdictionRate>,
  ) {}

  async findAll(): Promise<TaxJurisdiction[]> {
    return this.jurisdictionRepository.find({ order: { name: 'ASC' } });
  }

  async findByCode(code: string): Promise<TaxJurisdiction> {
    const jurisdiction = await this.jurisdictionRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!jurisdiction) {
      throw new NotFoundException(`Tax jurisdiction '${code}' not found`);
    }

    return jurisdiction;
  }

  async findById(id: string): Promise<TaxJurisdiction> {
    const jurisdiction = await this.jurisdictionRepository.findOne({ where: { id } });

    if (!jurisdiction) {
      throw new NotFoundException('Tax jurisdiction not found');
    }

    return jurisdiction;
  }

  /**
   * Rates in force on `date`.
   *
   * Always pass the transaction's own date, never "today": a return for 2025
   * must be built from the rates that applied in 2025.
   */
  async findRatesForDate(
    jurisdictionId: string,
    date: Date | string,
  ): Promise<TaxJurisdictionRate[]> {
    const on = toDateOnly(date);

    return this.rateRepository.find({
      where: [
        { jurisdictionId, validFrom: LessThanOrEqual(on), validTo: IsNull() },
        { jurisdictionId, validFrom: LessThanOrEqual(on), validTo: MoreThanOrEqual(on) },
      ],
      order: { kind: 'ASC', rate: 'DESC' },
    });
  }

  /** Every version of every rate, for the settings UI timeline. */
  async findAllRates(jurisdictionId: string): Promise<TaxJurisdictionRate[]> {
    return this.rateRepository.find({
      where: { jurisdictionId },
      order: { code: 'ASC', validFrom: 'ASC' },
    });
  }
}
