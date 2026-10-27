import {
  findStatementAmounts,
  isAmountPart,
  parseStatementAmount,
} from '@/modules/parsing/helpers/statement-amount.helper';
import {
  detectStatementCurrency,
  findAccountNumber,
  findStatementBalances,
  findStatementPeriod,
  isCreditCardStatement,
  readAccountHeading,
} from '@/modules/parsing/helpers/statement-metadata.helper';

describe('parseStatementAmount', () => {
  it.each([
    ['1,902.69', 1902.69],
    ['-1.450,77 €', -1450.77],
    ['1 200,45 $', 1200.45],
    ['SGD 15,450.75', 15450.75],
    ['S$ 12.00', 12],
    ['(12.00)', -12],
    ['100.00-', -100],
    ['0.00', 0],
    ['-R2 000.00', -2000],
    ['R7 822.73', 7822.73],
    ['RM12.00', 12],
  ])('reads %s', (text, expected) => {
    expect(parseStatementAmount(text)).toBe(expected);
  });

  it.each(['8373579', '44-2019-US', '1/3', '38.2gal', '2025', 'AR12.00'])('rejects %s', text => {
    expect(parseStatementAmount(text)).toBeNull();
  });

  it('keeps the sign of a figure whose currency sign is a letter', () => {
    expect(findStatementAmounts('ATM WITHDRAWAL -R2 000.00 R5 702.73')).toEqual([-2000, 5702.73]);
    expect(isAmountPart('-R2')).toBe(true);
    expect(isAmountPart('-$503.00')).toBe(true);
    expect(isAmountPart('$4,082.88')).toBe(true);
    expect(parseStatementAmount('-$503.00')).toBe(-503);
    expect(isAmountPart('R2D2')).toBe(false);
  });
});

describe('statement-metadata.helper', () => {
  it('takes the ISO code printed most often, upper case only', () => {
    expect(detectStatementCurrency('Try our app. EUR 1.00 and EUR 2.00, once USD')).toBe('EUR');
    expect(detectStatementCurrency('Try our new app today')).toBeNull();
  });

  it('reads which dollar from the prefix or the country', () => {
    expect(detectStatementCurrency('Total S$ 12.00')).toBe('SGD');
    expect(detectStatementCurrency('Example Bank Canada Inc.\nSolde 10,00 $')).toBe('CAD');
    expect(detectStatementCurrency('Balance $10.00')).toBe('USD');
    expect(detectStatementCurrency('Saldo 10,00 €')).toBe('EUR');
  });

  it('reads a currency sign written with letters, glued to the figure', () => {
    expect(detectStatementCurrency('Current Balance R13.40\nFEE -R60.00 R5 642.73')).toBe('ZAR');
    expect(detectStatementCurrency('Baki RM1,200.00')).toBe('MYR');
    expect(detectStatementCurrency('Saldo R$ 10,00')).toBe('BRL');
    expect(detectStatementCurrency('Ref R2D2 and route R66')).toBeNull();
  });

  it('finds the account number after its label, skipping a label with no number', () => {
    expect(findAccountNumber('Account Account No. Balance\nAccount Number 1234-5678-9012')).toBe(
      '1234-5678-9012',
    );
    expect(findAccountNumber('Account Number: XXXX XXXX XXXX 0001\nNext line 42')).toBe(
      'XXXX XXXX XXXX 0001',
    );
    expect(findAccountNumber('Numéro De Compte: 00001-002-0000003')).toBe('00001-002-0000003');
    expect(findAccountNumber('IBAN: NL00 TEST 0123 4567 89')).toBe('NL00TEST0123456789');
  });

  it('reads the statement period in either numeric order or with month names', () => {
    const dayMonth = (date?: Date) => date && [date.getDate(), date.getMonth() + 1];
    const us = findStatementPeriod('Opening/Closing Date 09/01/2025 - 09/30/2025', 'mdy');
    const fr = findStatementPeriod('1 janvier 2025 - 31 janvier 2025', 'dmy');
    expect([dayMonth(us?.from), dayMonth(us?.to)]).toEqual([[1, 9], [30, 9]]);
    expect([dayMonth(fr?.from), dayMonth(fr?.to)]).toEqual([[1, 1], [31, 1]]);
    expect(findStatementPeriod('Due 10/24/2025, issued 09/30/2025', 'mdy')).toBeNull();
  });

  it('reads balances from labels, skipping dates and taking the last figure', () => {
    const text = [
      "Solde d'ouverture 1 janvier 2025 10 750,00 $",
      'Balance Carried Forward: 2,181.67 2,002.15 15,271.23',
    ].join('\n');
    expect(findStatementBalances(text, 'dmy')).toEqual({ start: 10750, end: 15271.23 });
  });

  it('skips a label line without a figure and reads the next one', () => {
    const text = 'New Balance  REWARDS SUMMARY\nPrevious Balance 1,000.00\nNew Balance 1,250.50';
    expect(findStatementBalances(text, 'mdy')).toEqual({ start: 1000, end: 1250.5 });
  });

  it('reads two dated balances, the earlier one opening', () => {
    const text = 'Balance as of 31.05.2025: 900,00 €\nBalance as of 01.05.2025: 1.000,00 €';
    expect(findStatementBalances(text, 'dmy')).toEqual({ start: 1000, end: 900 });
  });

  it('reads an account heading: the number right after the word for account', () => {
    expect(readAccountHeading('HKD Current Account — 000-000001-001 (Continued)')).toEqual({
      accountNumber: '000-000001-001',
      currency: 'HKD',
    });
    expect(readAccountHeading('Numéro de compte: 00001-002-0000003')).toEqual({
      accountNumber: '00001-002-0000003',
    });
    expect(readAccountHeading('EXAMPLE CITY 19850-1423 Account number: XXXX XXXX 0001')).toBeNull();
    expect(readAccountHeading('Account Summary')).toBeNull();
  });

  it('tells a card statement by its wording', () => {
    expect(isCreditCardStatement('Minimum Payment Due 35.00\nPayment Due Date 10/24/2025')).toBe(true);
    expect(isCreditCardStatement('Payment received, thank you')).toBe(false);
  });
});
