import { BankName } from '../../../entities/statement.entity';
import { parseEachStatement } from '../helpers/pdf-statement-split.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BerekeBaseParser, type BerekeCellMap } from './bereke-base.parser';
import { BEREKE_STATEMENT_HEADER } from './bereke-new.parser';

type ColumnKey =
  | 'date'
  | 'document'
  | 'counterparty'
  | 'bin'
  | 'account'
  | 'bank'
  | 'debit'
  | 'credit'
  | 'purpose';

type BerekeOldGroupContext = {
  cells: BerekeCellMap<ColumnKey>;
  combinedText: string;
  counterpartyBlock: string;
  bankBlock: string;
  counterpartyDetails: {
    name: string;
    bin?: string;
    account?: string;
  };
  purpose: string;
};

export class BerekeOldParser extends BerekeBaseParser<ColumnKey> {
  protected readonly parserName = 'BerekeOldParser';

  /** A file can hold several statements, one per account; each is read on its own. */
  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    return parseEachStatement(filePath, cachedText, BEREKE_STATEMENT_HEADER, (part, text) =>
      super.parse(part, text),
    );
  }

  protected getSupportedBankName(): BankName {
    return BankName.BEREKE_OLD;
  }

  protected matchesBankText(text: string): boolean {
    return (
      text.includes('kz17722s000023921191') ||
      (text.includes('bereke') && !text.includes('kz47914042204kz039ly'))
    );
  }

  protected getBalanceStartLabels(): string[] {
    return ['Остаток на начало', 'Начальный остаток'];
  }

  protected getBalanceEndLabels(): string[] {
    return ['Остаток на конец', 'Конечный остаток'];
  }

  protected getDefaultMetadataDates(
    dateRange: { from: Date | null; to: Date | null },
    _transactions: ParsedTransaction[],
  ): { from: Date; to: Date } {
    return {
      from: dateRange.from || new Date(),
      to: dateRange.to || new Date(),
    };
  }

  protected isHeaderRow(text: string): boolean {
    const lower = text.toLowerCase();
    const keywords = ['дата', 'контрагент', 'дебет', 'кредит', 'назначение', 'номер'];
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
    if (lower.includes('контрагент')) {
      return 'counterparty';
    }
    if (lower.includes('бин')) {
      return 'bin';
    }
    if (lower.includes('сч')) {
      return 'account';
    }
    if (lower.includes('банк')) {
      return 'bank';
    }
    if (lower.includes('дебет')) {
      return 'debit';
    }
    if (lower.includes('кредит')) {
      return 'credit';
    }
    if (lower.includes('назнач') || lower.includes('основан')) {
      return 'purpose';
    }
    return null;
  }

  protected getExpectedColumnOrder(): ColumnKey[] {
    return [
      'date',
      'document',
      'counterparty',
      'bin',
      'account',
      'bank',
      'debit',
      'credit',
      'purpose',
    ];
  }

  protected createEmptyCells(): BerekeCellMap<ColumnKey> {
    return {
      date: '',
      document: '',
      counterparty: '',
      bin: '',
      account: '',
      bank: '',
      debit: '',
      credit: '',
      purpose: '',
    };
  }

  protected isEndOfTable(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes('итого') || (lower.includes('остаток') && !/\d{2}\.\d{2}\.\d{4}/.test(text))
    );
  }

  protected resolveCounterpartyBlock(
    cells: BerekeCellMap<ColumnKey>,
    combinedText: string,
  ): string {
    return (
      cells.counterparty ||
      cells.bin ||
      cells.account ||
      this.extractCounterpartyBlockFromText(combinedText)
    );
  }

  protected resolveBankBlock(cells: BerekeCellMap<ColumnKey>, combinedText: string): string {
    return cells.bank || this.extractBic(combinedText) || '';
  }

  protected sanitizePurpose(purpose: string): string {
    return purpose
      .replace(/[A-Z]{6}[A-Z0-9]{2,5}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  protected resolveCounterpartyNameForGroup({
    counterpartyDetails,
    counterpartyBlock,
    combinedText,
    purpose,
  }: BerekeOldGroupContext): string {
    return this.resolveCounterpartyName(
      counterpartyDetails.name ||
        counterpartyBlock ||
        this.extractCounterpartyNameFromText(combinedText) ||
        'Неизвестный контрагент',
      purpose,
      combinedText,
    );
  }

  protected finalizeBankBlock(bankBlock: string, combinedText: string): string {
    return bankBlock || this.extractBic(combinedText) || '';
  }
}
