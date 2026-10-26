import { Transaction } from '@/entities/transaction.entity';

/**
 * Seven places create transactions (import, scan, receipt, payable, manual,
 * custom table, telegram). The payee key is a pure function of the descriptor,
 * so the entity derives it on write and none of them can forget.
 */
describe('Transaction.payeeKey', () => {
  const row = (fields: Partial<Transaction>): Transaction =>
    Object.assign(new Transaction(), fields);

  it('derives the key from the counterparty when the row is written', () => {
    const transaction = row({ counterpartyName: 'REWE SAGT DANKE 6334 //BERLIN/DE' });

    transaction.derivePayeeKey();

    expect(transaction.payeeKey).toBe('rewe sagt danke berlin de');
  });

  it('gives the same key to the same shop on a different terminal', () => {
    const first = row({ counterpartyName: 'SQ *BLUE BOTTLE COFFEE 8821' });
    const second = row({ counterpartyName: 'SQ *BLUE BOTTLE COFFEE 9113' });

    first.derivePayeeKey();
    second.derivePayeeKey();

    expect(first.payeeKey).toBe(second.payeeKey);
  });

  it('leaves the key null when the descriptor holds no name', () => {
    const transaction = row({ counterpartyName: 'Неизвестный контрагент', paymentPurpose: '' });

    transaction.derivePayeeKey();

    expect(transaction.payeeKey).toBeNull();
  });

  it('follows the counterparty when it is edited', () => {
    const transaction = row({ counterpartyName: 'EDEKA HAMBURG' });
    transaction.derivePayeeKey();

    transaction.counterpartyName = 'REWE HAMBURG';
    transaction.derivePayeeKey();

    expect(transaction.payeeKey).toBe('rewe hamburg');
  });
});
