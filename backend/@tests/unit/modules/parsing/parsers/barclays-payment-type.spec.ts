import { PaymentType } from '@/contracts/transactions/payment-type';
import {
  BARCLAYS_PREFIXES,
  barclaysPaymentType,
} from '@/modules/parsing/parsers/barclays-payment-type';
import * as Schema from 'effect/Schema';

describe('barclaysPaymentType', () => {
  it.each([
    ['Card Payment to ACME Store Ltd', 'card'],
    ['Received from Example Co Ref: 1234', 'bank_transfer_in'],
    ['Sent to Member One', 'bank_transfer_out'],
    ['Bill Payment to Example Utility', 'bank_transfer_out'],
    ['Direct Debit to Example Insurance', 'direct_debit'],
    ['Standing Order to Example Landlord', 'standing_order'],
    ['Cash Withdrawal at Example Branch', 'cash'],
    ['Monthly Account Fee', 'fee'],
    ['Overdraft Fee', 'fee'],
    ['Credit Interest', 'interest'],
    ['Debit Interest', 'interest'],
  ])('%s is %s', (text, expected) => {
    expect(barclaysPaymentType(text)).toBe(expected);
  });

  it('ignores case and repeated spaces', () => {
    expect(barclaysPaymentType('  CARD   payment to  ACME ')).toBe('card');
  });

  it('leaves no match empty, a refund included', () => {
    expect(barclaysPaymentType('Card Payment from ACME Store Ltd')).toBeNull();
    expect(barclaysPaymentType('')).toBeNull();
    expect(barclaysPaymentType('Something else')).toBeNull();
  });

  it('only returns values of the closed list, each with its own wording', () => {
    expect(Object.keys(BARCLAYS_PREFIXES).sort()).toEqual([...PaymentType.literals].sort());
    for (const [type, prefixes] of Object.entries(BARCLAYS_PREFIXES)) {
      for (const prefix of prefixes) {
        expect(barclaysPaymentType(prefix)).toBe(type);
      }
    }
    expect(Schema.is(PaymentType)(barclaysPaymentType('Card Payment to X'))).toBe(true);
  });
});
