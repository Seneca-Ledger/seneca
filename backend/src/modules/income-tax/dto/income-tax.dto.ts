import { BadRequestException } from '@nestjs/common';
import type { TaxpayerType } from '../rule-packs/types';

const MIN_TAX_YEAR = 2000;
const TAXPAYER_TYPES: TaxpayerType[] = ['self_employed', 'employee', 'company'];

/** A year that can have a declaration: not before 2000, not beyond next year. */
export function parseTaxYear(value: string | number | undefined): number {
  const year = Number(value);
  const maxYear = new Date().getUTCFullYear() + 1;
  if (!Number.isInteger(year) || year < MIN_TAX_YEAR || year > maxYear) {
    throw new BadRequestException(`taxYear must be a year between ${MIN_TAX_YEAR} and ${maxYear}`);
  }
  return year;
}
