import { BankName } from '../../../entities/statement.entity';
import { parseEachStatement } from '../helpers/pdf-statement-split.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BerekeBaseParser, type BerekeCellMap } from './bereke-base.parser';

/** A Bereke statement's header names its own account after "Счет №". */
export const BEREKE_STATEMENT_HEADER = /Сч[её]т\s*№\s*(KZ[0-9A-Z]{18})/i;

type ColumnKey = 'date' | 'document' | 'counterparty' | 'bank' | 'debit' | 'credit' | 'purpose';

export class BerekeNewParser extends BerekeBaseParser<ColumnKey> {
  protected readonly parserName = 'BerekeNewParser';

  /** A file can hold several statements, one per account; each is read on its own. */
  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    return parseEachStatement(filePath, cachedText, BEREKE_STATEMENT_HEADER, (part, text) =>
      super.parse(part, text),
    );
  }

  protected getSupportedBankName(): BankName {
    return BankName.BEREKE_NEW;
  }

  protected matchesBankText(text: string): boolean {
    return (
      text.includes('bereke') || text.includes('береке') || text.includes('kz47914042204kz039ly')
    );
  }

  protected getBalanceStartLabels(): string[] {
    return ['Остаток на начало', 'Остаток на начало периода'];
  }

  protected getBalanceEndLabels(): string[] {
    return ['Остаток на конец', 'Остаток на конец периода'];
  }

  protected getDefaultMetadataDates(
    dateRange: { from: Date | null; to: Date | null },
    transactions: ParsedTransaction[],
  ): { from: Date; to: Date } {
    const inferred = this.inferDateRangeFromTransactions(transactions);
    const resolvedFrom = dateRange.from || inferred.from || new Date();
    const resolvedTo = dateRange.to || inferred.to || resolvedFrom;

    return {
      from: resolvedFrom,
      to: resolvedTo,
    };
  }

  protected isHeaderRow(text: string): boolean {
    const lower = text.toLowerCase();
    const keywords = ['дата', 'номер', 'контрагент', 'дебет', 'кредит', 'назначение'];
    return keywords.filter(keyword => lower.includes(keyword)).length >= 3;
  }

  protected detectColumnKey(label: string): ColumnKey | null {
    const lower = label.toLowerCase();
    if (lower.includes('дата')) {
      return 'date';
    }
    if (lower.includes('номер')) {
      return 'document';
    }
    if (lower.includes('банк') && lower.includes('контрагент')) {
      return 'bank';
    }
    if (lower.includes('контрагент')) {
      return 'counterparty';
    }
    if (lower.includes('дебет')) {
      return 'debit';
    }
    if (lower.includes('кредит')) {
      return 'credit';
    }
    if (lower.includes('назнач')) {
      return 'purpose';
    }
    return null;
  }

  protected getExpectedColumnOrder(): ColumnKey[] {
    return ['date', 'document', 'counterparty', 'bank', 'debit', 'credit', 'purpose'];
  }

  protected createEmptyCells(): BerekeCellMap<ColumnKey> {
    return {
      date: '',
      document: '',
      counterparty: '',
      bank: '',
      debit: '',
      credit: '',
      purpose: '',
    };
  }

  protected isEndOfTable(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes('итого обороты') ||
      (lower.includes('остаток') && !/\d{2}\.\d{2}\.\d{4}/.test(text))
    );
  }

  protected resolveCounterpartyBlock(cells: BerekeCellMap<ColumnKey>): string {
    return cells.counterparty || '';
  }

  protected resolveBankBlock(cells: BerekeCellMap<ColumnKey>): string {
    return cells.bank || '';
  }
}
