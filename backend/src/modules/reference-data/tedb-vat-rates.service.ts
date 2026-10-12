import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferenceData } from '../../entities/reference-data.entity';
import {
  REFERENCE_FETCH,
  REQUEST_TIMEOUT_MS,
  type ReferenceFetch,
  referenceDataOffline,
} from './reference-fetch';

const SOURCE = 'tedb';
const ENDPOINT = 'https://ec.europa.eu/taxation_customs/tedb/ws/';
const SOAP_ACTION = 'urn:ec.europa.eu:taxud:tedb:services:v1:VatRetrievalService/RetrieveVatRates';
export const TEDB_PAGE = 'https://ec.europa.eu/taxation_customs/tedb/';

/** A stored snapshot is reused for this long before TEDB is asked again. */
const FRESH_FOR_MS = 6 * 60 * 60 * 1000;

export type ReducedKind = 'reduced' | 'super_reduced' | 'parking';

export interface TedbReducedRate {
  rate: number;
  kind: ReducedKind;
  /** TEDB's category identifiers the rate applies to, e.g. FOODSTUFFS. */
  categories: string[];
}

/** The rates in force from `from` until the next version. */
export interface TedbVersion {
  from: string;
  /** NULL when TEDB lists more than one general standard rate. */
  standard: number | null;
  reduced: TedbReducedRate[];
}

export interface TedbSnapshot {
  country: string;
  /** The range asked for. */
  rangeFrom: string;
  rangeTo: string;
  versions: TedbVersion[];
}

const REDUCED_TYPES: Record<string, ReducedKind> = {
  REDUCED_RATE: 'reduced',
  SUPER_REDUCED_RATE: 'super_reduced',
  PARKING_RATE: 'parking',
};

/** TEDB names Greece EL, as VIES does. */
export function tedbCountry(countryCode: string): string {
  const code = countryCode.toUpperCase();
  return code === 'GR' ? 'EL' : code;
}

function text(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`));
  return match ? match[1].trim() : null;
}

interface VersionDraft {
  standard: Set<number>;
  reduced: Map<string, TedbReducedRate>;
}

interface TedbResult {
  situationOn: string;
  valueType: string;
  value: number;
  category: string | null;
  comment: string;
}

/** One vatRateResults block; NULL when it lacks a date, a rate or a number. */
function readResult(block: string): TedbResult | null {
  const situationOn = text(block, 'situationOn')?.slice(0, 10);
  const rate = text(block, 'rate');
  const value = Number(text(rate ?? '', 'value'));
  if (!(situationOn && rate && Number.isFinite(value))) {
    return null;
  }
  return {
    situationOn,
    valueType: text(rate, 'type') ?? '',
    value,
    category: text(text(block, 'category') ?? '', 'identifier'),
    comment: text(block, 'comment') ?? '',
  };
}

function addToVersion(version: VersionDraft, result: TedbResult): void {
  if (result.valueType === 'DEFAULT') {
    if (!/^VAT - (?!Import)/.test(result.comment)) {
      version.standard.add(result.value);
    }
    return;
  }
  const kind = REDUCED_TYPES[result.valueType];
  if (!kind || result.category === 'REGION') {
    return;
  }
  const key = `${kind}:${result.value}`;
  const entry = version.reduced.get(key) ?? { rate: result.value, kind, categories: [] };
  if (result.category && !entry.categories.includes(result.category)) {
    entry.categories.push(result.category);
  }
  version.reduced.set(key, entry);
}

/**
 * Turns TEDB's answer into versions of the general rates.
 *
 * TEDB returns a snapshot for every date its data changed, each a list of
 * rates per category. Rates for a special territory (category REGION, or a
 * standard rate commented "VAT - <territory>", like the Canary Islands) are
 * left out: they are not what a business on the mainland charges.
 */
export function parseTedbResponse(xml: string): TedbVersion[] {
  const byDate = new Map<string, VersionDraft>();
  const results = xml.match(/<(?:\w+:)?vatRateResults>[\s\S]*?<\/(?:\w+:)?vatRateResults>/g) ?? [];

  for (const result of results) {
    const read = readResult(result);
    if (!read) {
      continue;
    }
    const version = byDate.get(read.situationOn) ?? { standard: new Set(), reduced: new Map() };
    byDate.set(read.situationOn, version);
    addToVersion(version, read);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([from, version]) => ({
      from,
      standard: version.standard.size === 1 ? [...version.standard][0] : null,
      reduced: [...version.reduced.values()].sort((a, b) => a.rate - b.rate),
    }));
}

/**
 * EU VAT rates from the European Commission's Taxes in Europe Database, the
 * official register the member states report their rates to. Read through
 * its public SOAP service; nothing here is applied on its own — the rates are
 * compared with the workspace's and any difference is put to the user.
 */
@Injectable()
export class TedbVatRatesService {
  private readonly logger = new Logger(TedbVatRatesService.name);
  private readonly fetchImpl: ReferenceFetch;

  constructor(
    @InjectRepository(ReferenceData)
    private readonly referenceRepository: Repository<ReferenceData>,
    @Optional() @Inject(REFERENCE_FETCH) fetchImpl?: ReferenceFetch,
  ) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  /** The stored snapshot, without asking TEDB. */
  async stored(countryCode: string): Promise<{ snapshot: TedbSnapshot; fetchedAt: Date } | null> {
    const row = await this.referenceRepository.findOne({
      where: { source: SOURCE, key: countryCode.toUpperCase() },
    });
    return row ? { snapshot: row.payload as TedbSnapshot, fetchedAt: row.fetchedAt } : null;
  }

  /**
   * The country's rates from two years back to a year ahead, so a change
   * already announced is seen before it applies. A snapshot fetched in the
   * last hours is reused unless `force` is set. NULL when TEDB cannot be
   * reached and nothing is stored.
   */
  async snapshot(
    countryCode: string,
    options: { force?: boolean; today?: Date } = {},
  ): Promise<{ snapshot: TedbSnapshot; fetchedAt: Date } | null> {
    const country = countryCode.toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      return null;
    }
    const stored = await this.stored(country);
    if (
      stored &&
      !options.force &&
      Date.now() - new Date(stored.fetchedAt).getTime() < FRESH_FOR_MS
    ) {
      return stored;
    }
    if (referenceDataOffline()) {
      return stored;
    }

    const today = options.today ?? new Date();
    const yearsFrom = (years: number) =>
      new Date(Date.UTC(today.getUTCFullYear() + years, today.getUTCMonth(), today.getUTCDate()))
        .toISOString()
        .slice(0, 10);
    const rangeFrom = yearsFrom(-2);
    const rangeTo = yearsFrom(1);

    let versions: TedbVersion[];
    try {
      const response = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${SOAP_ACTION}"` },
        body: this.request(tedbCountry(country), rangeFrom, rangeTo),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 4),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      versions = parseTedbResponse(await response.text());
    } catch (error) {
      this.logger.warn(`TEDB rates for ${country} unavailable: ${(error as Error).message}`);
      return stored;
    }
    // An answer without any standard rate is not a country without VAT.
    if (!versions.some(version => version.standard !== null)) {
      this.logger.warn(`TEDB returned no standard rate for ${country}`);
      return stored;
    }

    const snapshot: TedbSnapshot = { country, rangeFrom, rangeTo, versions };
    const fetchedAt = new Date();
    await this.referenceRepository.upsert(
      { source: SOURCE, key: country, payload: snapshot, fetchedAt },
      ['source', 'key'],
    );
    return { snapshot, fetchedAt };
  }

  private request(memberState: string, from: string, to: string): string {
    return [
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"',
      ' xmlns:msg="urn:ec.europa.eu:taxud:tedb:services:v1:IVatRetrievalService"',
      ' xmlns:t="urn:ec.europa.eu:taxud:tedb:services:v1:IVatRetrievalService:types">',
      '<soapenv:Header/><soapenv:Body><msg:retrieveVatRatesReqMsg>',
      `<t:memberStates><t:isoCode>${memberState}</t:isoCode></t:memberStates>`,
      `<t:from>${from}</t:from><t:to>${to}</t:to>`,
      '</msg:retrieveVatRatesReqMsg></soapenv:Body></soapenv:Envelope>',
    ].join('');
  }
}
