import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { isEuCountry } from '../tax/eu-membership';
import {
  REFERENCE_FETCH,
  REQUEST_TIMEOUT_MS,
  type ReferenceFetch,
  referenceDataOffline,
} from './reference-fetch';

const API = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms';

export interface VatIdCheck {
  /** unavailable: VIES or the member state's register did not answer; nothing is known. */
  status: 'valid' | 'invalid' | 'unavailable';
  /** The registered name, when the member state discloses it. */
  name: string | null;
  checkedAt: Date;
}

/** VIES names Greece EL. */
function viesCountry(countryCode: string): string {
  const code = countryCode.toUpperCase();
  return code === 'GR' ? 'EL' : code;
}

/**
 * The number as VIES wants it: no spaces, dots or dashes, and without the
 * country prefix people often type in front of it.
 */
export function normalizeVatNumber(countryCode: string, vatId: string): string {
  const compact = vatId.toUpperCase().replace(/[\s.\-/]/g, '');
  const prefixes = [countryCode.toUpperCase(), viesCountry(countryCode)];
  const prefix = prefixes.find(candidate => compact.startsWith(candidate));
  return prefix ? compact.slice(prefix.length) : compact;
}

/**
 * Checks an EU VAT number against VIES, the Commission's front to the member
 * states' registers. Only `valid` and `invalid` are answers; a register that
 * is down (Germany's often is) says nothing about the number.
 */
@Injectable()
export class ViesService {
  private readonly logger = new Logger(ViesService.name);
  private readonly fetchImpl: ReferenceFetch;

  constructor(@Optional() @Inject(REFERENCE_FETCH) fetchImpl?: ReferenceFetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  /** Whether VIES can say anything about a number from this country. */
  covers(countryCode: string | null): boolean {
    return Boolean(countryCode) && isEuCountry(String(countryCode));
  }

  async check(countryCode: string, vatId: string): Promise<VatIdCheck> {
    const checkedAt = new Date();
    const country = viesCountry(countryCode);
    const number = normalizeVatNumber(countryCode, vatId);
    if (!this.covers(countryCode)) {
      return { status: 'unavailable', name: null, checkedAt };
    }
    if (!/^[A-Z0-9+*]{2,14}$/.test(number)) {
      // Not something any register could hold.
      return { status: 'invalid', name: null, checkedAt };
    }
    if (referenceDataOffline()) {
      return { status: 'unavailable', name: null, checkedAt };
    }

    try {
      const response = await this.fetchImpl(`${API}/${country}/vat/${encodeURIComponent(number)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = (await response.json()) as {
        isValid?: boolean;
        userError?: string;
        name?: string;
      };
      if (body.userError === 'VALID' && body.isValid === true) {
        const name = body.name && body.name !== '---' ? body.name.trim() : null;
        return { status: 'valid', name: name || null, checkedAt };
      }
      if (body.userError === 'INVALID' && body.isValid === false) {
        return { status: 'invalid', name: null, checkedAt };
      }
      // MS_UNAVAILABLE, TIMEOUT, MS_MAX_CONCURRENT_REQ and the like.
      return { status: 'unavailable', name: null, checkedAt };
    } catch (error) {
      this.logger.warn(`VIES check for ${country} unavailable: ${(error as Error).message}`);
      return { status: 'unavailable', name: null, checkedAt };
    }
  }
}
