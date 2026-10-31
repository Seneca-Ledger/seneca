import { BankName } from '../../../entities/statement.entity';
import type { IParser } from '../interfaces/parser.interface';
import { AbsaParser } from '../parsers/absa.parser';
import { AllyParser } from '../parsers/ally.parser';
import { AnzParser } from '../parsers/anz.parser';
import { AssociatedParser } from '../parsers/associated.parser';
import { AtbParser } from '../parsers/atb.parser';
import { AxisParser } from '../parsers/axis.parser';
import { BancoDoBrasilParser } from '../parsers/banco-do-brasil.parser';
import { BankOfChinaParser } from '../parsers/bank-of-china.parser';
import { BankOfScotlandParser } from '../parsers/bank-of-scotland.parser';
import { BarclaysParser } from '../parsers/barclays.parser';
import { BerekeNewParser } from '../parsers/bereke-new.parser';
import { BerekeOldParser } from '../parsers/bereke-old.parser';
import { Camt053Parser } from '../parsers/camt053.parser';
import { CsvParser } from '../parsers/csv.parser';
import { DocxParser } from '../parsers/docx.parser';
import { ExcelParser } from '../parsers/excel.parser';
import { GenericPdfParser } from '../parsers/generic-pdf.parser';
import { HapoalimParser } from '../parsers/hapoalim.parser';
import { KaspiParser } from '../parsers/kaspi.parser';
import { Mt940Parser } from '../parsers/mt940.parser';
import { OfxParser } from '../parsers/ofx.parser';
import { QifParser } from '../parsers/qif.parser';

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
  [AnzParser, { bankName: BankName.ANZ }],
  [AssociatedParser, { bankName: BankName.ASSOCIATED }],
  [AtbParser, { bankName: BankName.ATB }],
  [AxisParser, { bankName: BankName.AXIS }],
  [BancoDoBrasilParser, { bankName: BankName.BANCO_DO_BRASIL }],
  [BankOfChinaParser, { bankName: BankName.BANK_OF_CHINA }],
  [BankOfScotlandParser, { bankName: BankName.BANK_OF_SCOTLAND }],
  [BarclaysParser, { bankName: BankName.BARCLAYS }],
  [BerekeNewParser, { bankName: BankName.BEREKE_NEW, formatVersion: 'new' }],
  [BerekeOldParser, { bankName: BankName.BEREKE_OLD, formatVersion: 'old' }],
];

/**
 * Every parser, in the order the factory asks them: bank-specific parsers
 * before the generic ones they extend or would otherwise be shadowed by.
 */
export function createParsers(): IParser[] {
  return [
    new BerekeNewParser(),
    new BerekeOldParser(),
    new KaspiParser(),
    new HapoalimParser(),
    new AbsaParser(),
    new AllyParser(),
    new AnzParser(),
    new AssociatedParser(),
    new AtbParser(),
    new AxisParser(),
    new BancoDoBrasilParser(),
    new BankOfChinaParser(),
    new BankOfScotlandParser(),
    new BarclaysParser(),
    new GenericPdfParser(),
    new ExcelParser(),
    new CsvParser(),
    new DocxParser(),
    new OfxParser(),
    new QifParser(),
    new Camt053Parser(),
    new Mt940Parser(),
  ];
}
