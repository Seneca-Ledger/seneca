import { appDefaultCurrency } from '@/common/utils/currency.util';
import { normalizeDate, normalizeNumber } from '@/common/utils/number-normalizer.util';
import {
  mapParsedTransaction,
  stripHtmlForAi,
  unwrapAiJson,
} from '@/common/utils/ai-response.util';

describe('AI response utilities', () => {
  it('unwraps fenced json responses', () => {
    expect(unwrapAiJson('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
    expect(unwrapAiJson('{"ok":true}')).toBe('{"ok":true}');
  });

  it('strips html into normalized plain text', () => {
    expect(stripHtmlForAi('<p>Hello&nbsp;<strong>world</strong></p>')).toBe('Hello world');
  });

  it('maps raw ai transaction payloads into parsed transactions', () => {
    const mapped = mapParsedTransaction(
      {
        date: '2026-01-15',
        document_number: 'DOC-1',
        counterparty_name: 'Acme',
        amount_debit: '1200.50',
        purpose: 'Invoice payment',
      },
      { normalizeDate, normalizeNumber },
    );

    expect(mapped).toEqual({
      transactionDate: new Date('2026-01-15T00:00:00.000Z'),
      documentNumber: 'DOC-1',
      counterpartyName: 'Acme',
      counterpartyBin: undefined,
      counterpartyAccount: undefined,
      counterpartyBank: undefined,
      debit: 1200.5,
      credit: undefined,
      paymentPurpose: 'Invoice payment',
      currency: appDefaultCurrency(),
    });
  });

  it('returns null when ai transaction has no valid date', () => {
    expect(mapParsedTransaction({ amount: '100' }, { normalizeDate, normalizeNumber })).toBeNull();
  });
});
