import { BankName } from '../../../entities/statement.entity';
import type { IParser } from '../interfaces/parser.interface';
import { AbsaParser } from '../parsers/absa.parser';
import { AllyParser } from '../parsers/ally.parser';
import { BerekeNewParser } from '../parsers/bereke-new.parser';
import { BerekeOldParser } from '../parsers/bereke-old.parser';
import { HapoalimParser } from '../parsers/hapoalim.parser';
import { KaspiParser } from '../parsers/kaspi.parser';

/**
 * Bank-specific parsers that may claim a file when its text names no bank,
 * in the order they are tried, with what each claims it as.
 */
export const FALLBACK_CLAIMS: [
  abstract new (...args: never[]) => IParser,
  { bankName: BankName; formatVersion?: string },
][] = [
  [KaspiParser, { bankName: BankName.KASPI }],
  [HapoalimParser, { bankName: BankName.HAPOALIM }],
  [AbsaParser, { bankName: BankName.ABSA }],
  [AllyParser, { bankName: BankName.ALLY }],
  [BerekeNewParser, { bankName: BankName.BEREKE_NEW, formatVersion: 'new' }],
  [BerekeOldParser, { bankName: BankName.BEREKE_OLD, formatVersion: 'old' }],
];
