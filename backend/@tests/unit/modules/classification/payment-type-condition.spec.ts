import { BadRequestException } from '@nestjs/common';
import type { Transaction } from '@/entities/transaction.entity';
import { matchesConditions } from '@/modules/classification/engine/rule-conditions';
import type { ClassificationCondition } from '@/modules/classification/interfaces/classification-rule.interface';
import { assertConditionsValid } from '@/modules/classification/helpers/rule-validation';

const row = (paymentType: Transaction['paymentType']) => ({ paymentType }) as Transaction;
const equals = (value: string): ClassificationCondition => ({
  field: 'payment_type',
  operator: 'equals',
  value,
});

describe('payment_type rule condition', () => {
  it('matches a row paid that way', () => {
    expect(matchesConditions(row('card'), [equals('card')])).toBe(true);
    expect(matchesConditions(row('bank_transfer_in'), [equals('card')])).toBe(false);
  });

  it('never matches a row with no payment type', () => {
    expect(matchesConditions(row(null), [equals('card')])).toBe(false);
  });

  it('accepts equals with any value of the closed list', () => {
    expect(() => assertConditionsValid([equals('card'), equals('direct_debit')])).not.toThrow();
  });

  it('rejects a value outside the list', () => {
    expect(() => assertConditionsValid([equals('cheque')])).toThrow(BadRequestException);
  });

  it.each(['contains', 'regex', 'starts_with', 'ends_with'] as const)(
    'rejects the %s operator',
    operator => {
      expect(() =>
        assertConditionsValid([{ field: 'payment_type', operator, value: 'card' }]),
      ).toThrow(BadRequestException);
    },
  );
});
