import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { ReferenceData } from '../../entities/reference-data.entity';
import { Workspace } from '../../entities/workspace.entity';
import {
  REFERENCE_FETCH,
  REQUEST_TIMEOUT_MS,
  type ReferenceFetch,
  referenceDataOffline,
} from './reference-fetch';

const SOURCE = 'openholidays';
const API = 'https://openholidaysapi.org/PublicHolidays';

/**
 * Countries OpenHolidays covers among those Seneca files taxes for (its
 * /Countries list, read 2026-10-11). Cyprus, Denmark, Finland, Greece, the UK,
 * the UAE and Kazakhstan are not covered: their deadlines skip weekends only.
 */
export const HOLIDAY_COUNTRIES: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'CZ',
  'DE',
  'EE',
  'ES',
  'FR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
]);

/** A failed fetch is not retried on every request, only after this long. */
const RETRY_AFTER_MS = 60 * 60 * 1000;

export interface HolidayPayload {
  holidays: Array<{ date: string; name: string }>;
}

interface OpenHoliday {
  startDate: string;
  endDate: string;
  type: string;
  nationwide: boolean;
  name?: Array<{ language: string; text: string }>;
}

function* daysBetween(start: string, end: string): Generator<string> {
  const day = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (day <= last) {
    yield day.toISOString().slice(0, 10);
    day.setUTCDate(day.getUTCDate() + 1);
  }
}

/**
 * Nationwide public holidays, from OpenHolidays (an open-data project, not a
 * government source), used only to move a tax deadline off a day the tax
 * office is closed. Regional holidays are left out: they do not move a
 * deadline for everyone in the country, and skipping one leaves the date a
 * day early, never late.
 */
@Injectable()
export class PublicHolidaysService {
  private readonly logger = new Logger(PublicHolidaysService.name);
  private readonly failedAt = new Map<string, number>();
  private readonly fetchImpl: ReferenceFetch;

  constructor(
    @InjectRepository(ReferenceData)
    private readonly referenceRepository: Repository<ReferenceData>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @Optional() @Inject(REFERENCE_FETCH) fetchImpl?: ReferenceFetch,
  ) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  /**
   * The country's holidays (YYYY-MM-DD) in these years. A year not stored
   * yet is fetched now; when that fails the set simply lacks it.
   */
  async holidaysFor(countryCode: string, years: number[]): Promise<Set<string>> {
    const country = countryCode.toUpperCase();
    if (!HOLIDAY_COUNTRIES.has(country) || years.length === 0) {
      return new Set();
    }
    const keys = years.map(year => `${country}:${year}`);
    const rows = await this.referenceRepository.find({ where: { source: SOURCE, key: In(keys) } });
    const stored = new Map(rows.map(row => [row.key, row.payload as HolidayPayload]));

    for (const year of years) {
      const key = `${country}:${year}`;
      if (!stored.has(key)) {
        const fetched = await this.refresh(country, year);
        if (fetched) {
          stored.set(key, fetched);
        }
      }
    }
    return new Set([...stored.values()].flatMap(payload => payload.holidays.map(h => h.date)));
  }

  /** Fetches and stores one country-year; NULL when it could not be fetched. */
  async refresh(country: string, year: number): Promise<HolidayPayload | null> {
    const key = `${country}:${year}`;
    const failed = this.failedAt.get(key);
    if (referenceDataOffline() || (failed && Date.now() - failed < RETRY_AFTER_MS)) {
      return null;
    }

    let holidays: OpenHoliday[];
    try {
      const query = new URLSearchParams({
        countryIsoCode: country,
        validFrom: `${year}-01-01`,
        validTo: `${year}-12-31`,
        languageIsoCode: 'EN',
      });
      const response = await this.fetchImpl(`${API}?${query}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      holidays = (await response.json()) as OpenHoliday[];
      if (!Array.isArray(holidays)) {
        throw new Error('unexpected response');
      }
    } catch (error) {
      this.failedAt.set(key, Date.now());
      this.logger.warn(`Public holidays for ${key} unavailable: ${(error as Error).message}`);
      return null;
    }

    const payload: HolidayPayload = {
      holidays: holidays
        .filter(holiday => holiday.type === 'Public' && holiday.nationwide === true)
        .flatMap(holiday => {
          const name =
            holiday.name?.find(item => item.language === 'EN')?.text ??
            holiday.name?.[0]?.text ??
            '';
          return [...daysBetween(holiday.startDate, holiday.endDate)].map(date => ({ date, name }));
        })
        .filter(holiday => holiday.date.startsWith(String(year)))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
    // An empty answer for a covered country is a fault upstream, not a year without holidays.
    if (payload.holidays.length === 0) {
      this.failedAt.set(key, Date.now());
      return null;
    }

    await this.referenceRepository.upsert({ source: SOURCE, key, payload, fetchedAt: new Date() }, [
      'source',
      'key',
    ]);
    this.failedAt.delete(key);
    return payload;
  }

  /**
   * Re-reads the holidays of every country a workspace files in, for this
   * year and the next two, so a holiday added by law reaches the deadlines.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async refreshAll(today: Date = new Date()): Promise<void> {
    const rows: Array<{ code: string }> = await this.workspaceRepository
      .createQueryBuilder('workspace')
      .innerJoin('workspace.taxJurisdiction', 'jurisdiction')
      .select('DISTINCT jurisdiction.code', 'code')
      .where({ taxJurisdictionId: Not(IsNull()) })
      .getRawMany();
    const year = today.getUTCFullYear();
    for (const { code } of rows) {
      if (!HOLIDAY_COUNTRIES.has(code)) {
        continue;
      }
      for (const target of [year, year + 1, year + 2]) {
        this.failedAt.delete(`${code}:${target}`);
        await this.refresh(code, target);
      }
    }
  }
}
