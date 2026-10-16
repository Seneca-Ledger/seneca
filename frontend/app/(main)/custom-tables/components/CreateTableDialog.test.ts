import { describe, expect, it } from 'vitest';
import { distinctName } from './CreateTableDialog';

describe('distinctName', () => {
  it('keeps a name nobody uses', () => {
    expect(distinctName('Transactions', ['Invoices'])).toBe('Transactions');
  });

  it('numbers a name already taken, ignoring case and spaces', () => {
    expect(distinctName('Transactions', [' transactions ', 'Transactions 2'])).toBe(
      'Transactions 3',
    );
  });
});
