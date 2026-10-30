import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/**
 * The bank's name is only in its logo, an image: the statement is known by
 * its layout. The title, the table header and the overdraft block under it
 * appear together on Banco do Brasil's current account statement.
 */
const BB_MARKERS = [
  /\bExtrato de Conta Corrente\b/i,
  /\bDia\s+Hist[óo]rico\s+Valor\b/i,
  /\bInforma[çc][õo]es Adicionais\b/i,
  /\bCHEQUE ESPECIAL\b/,
];

/** The closing balance row, printed letter-spaced: "S A L D O 89.500,00 (+)". */
const CLOSING = /\bS\s?A\s?L\s?D\s?O\s+([\d.]+,\d{2})\s?\(([+-])\)/;

/** A time, a CPF or CNPJ, an agency or an account number ahead of the name. */
const LEADING_NUMBERS = /^(?:[\d:./-]+\s+)+/;
/** A fee's details say what it charges for ("Cobrança referente 10/07/2023"), not who. */
const FEE_NOTE = /^Cobran[çc]a referente\b/i;

export function isBancoDoBrasilStatement(text: string): boolean {
  return BB_MARKERS.every(marker => marker.test(text));
}

export function bancoDoBrasilClosingBalance(text: string): number | null {
  const match = text.match(CLOSING);
  if (!match) {
    return null;
  }
  const value = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return match[2] === '-' ? -value : value;
}

/**
 * The dated line names the kind of entry ("PIX - Recebido", "Compra com
 * cartao"); the line under the amount names who it was with, after the time
 * and the payer's document number. A fee keeps its kind.
 */
export function bancoDoBrasilCounterparty(row: LayoutTransaction): string {
  const below = row.description.slice(row.firstLine.length).trim();
  const name = below.replace(LEADING_NUMBERS, '').trim();
  return name && !FEE_NOTE.test(name) ? name : row.firstLine;
}

/**
 * Banco do Brasil (Brazil) current account statement: one signed amount per
 * row ("1.500,00 (-)") printed between the entry's kind and its details, no
 * running balance, the opening and closing balance as rows of their own. The
 * generic layout reading reads the table; this adds the bank, the payee and
 * the closing balance.
 */
export class BancoDoBrasilParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.BANCO_DO_BRASIL && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isBancoDoBrasilStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const parsed = await super.parse(filePath, text);
    const closing = bancoDoBrasilClosingBalance(text);
    return {
      ...parsed,
      metadata: { ...parsed.metadata, balanceEnd: closing ?? parsed.metadata.balanceEnd },
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || bancoDoBrasilCounterparty(row),
    }));
  }
}
