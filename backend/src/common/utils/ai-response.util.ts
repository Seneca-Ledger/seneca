import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { currencyCodeOrDefault } from './currency.util';

export function unwrapAiJson(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

export function stripHtmlForAi(value: string): string {
  return value
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapParsedTransaction(
  raw: Record<string, unknown>,
  normalizers: {
    normalizeDate: (value: string) => Date | null;
    normalizeNumber: (value: string | number | null | undefined) => number | null;
  },
): ParsedTransaction | null {
  const stringValue = (value: unknown): string => (typeof value === 'string' ? value : '');
  const optionalStringValue = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value : undefined;
  const numberInput = (value: unknown): string | number | null | undefined => {
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }

    if (value == null) {
      return value as null | undefined;
    }

    return undefined;
  };

  const transactionDateCandidate = raw.date ?? raw.transactionDate ?? raw.date_iso;
  const transactionDate = normalizers.normalizeDate(stringValue(transactionDateCandidate)) || null;

  if (!transactionDate) {
    return null;
  }

  const debit =
    normalizers.normalizeNumber(numberInput(raw.debit ?? raw.amount_debit ?? raw.amount)) ||
    undefined;
  const credit =
    normalizers.normalizeNumber(numberInput(raw.credit ?? raw.amount_credit ?? raw.incoming)) ||
    undefined;

  const counterpartyName =
    optionalStringValue(raw.counterparty_name) ||
    optionalStringValue(raw.counterparty) ||
    optionalStringValue(raw.beneficiary) ||
    optionalStringValue(raw.receiver) ||
    optionalStringValue(raw.payer) ||
    optionalStringValue(raw.partner) ||
    optionalStringValue(raw.beneficiary_name) ||
    'Неизвестный контрагент';

  const counterpartyBank =
    optionalStringValue(raw.counterparty_bank) ||
    optionalStringValue(raw.bank) ||
    optionalStringValue(raw.bank_name) ||
    optionalStringValue(raw.beneficiary_bank) ||
    optionalStringValue(raw.receiver_bank) ||
    optionalStringValue(raw.bank_bic) ||
    optionalStringValue(raw.bic);

  const counterpartyBin =
    optionalStringValue(raw.counterparty_bin) ||
    optionalStringValue(raw.bin) ||
    optionalStringValue(raw.iin) ||
    optionalStringValue(raw.tax_id);

  return {
    transactionDate,
    documentNumber:
      optionalStringValue(raw.document_number) ||
      optionalStringValue(raw.document) ||
      optionalStringValue(raw.doc) ||
      optionalStringValue(raw.doc_number),
    counterpartyName,
    counterpartyBin,
    counterpartyAccount:
      optionalStringValue(raw.counterparty_account) || optionalStringValue(raw.account),
    counterpartyBank,
    debit,
    credit,
    paymentPurpose:
      (raw?.purpose || raw?.payment_purpose || raw?.description || raw?.comment || '')
        .toString()
        .trim() || 'Не указано',
    // The statement's own currency, and the workspace's after it, override
    // this when the transaction is persisted; this is only the last resort.
    currency: currencyCodeOrDefault(optionalStringValue(raw.currency)),
  };
}
