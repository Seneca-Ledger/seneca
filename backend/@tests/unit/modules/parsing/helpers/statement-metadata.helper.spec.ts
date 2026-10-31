import {
  findStatementAmounts,
  isAmountPart,
  parseStatementAmount,
} from '@/modules/parsing/helpers/statement-amount.helper';
import {
  detectStatementCurrency,
  findAccountNumber,
  findBalanceRowPeriod,
  findStatementBalances,
  findStatementAnchor,
  findStatementPeriod,
  isBalanceLabel,
  isCreditCardStatement,
  isTotalsLabel,
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
    ['.11', 0.11],
    ['1.500,00 (-)', -1500],
    ['120.000,00(+)', 120000],
    ['1,000.00 Cr', 1000],
    ['250.00 DR', -250],
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

  it('reads rupees from an Indian bank code when no currency is printed', () => {
    expect(detectStatementCurrency('IFSC Code :EXMP0000001\nBalance 1490.11')).toBe('INR');
    expect(detectStatementCurrency('Balance 1490.11')).toBeNull();
  });

  it('reads reais from Brazilian payment words when no currency is printed', () => {
    expect(detectStatementCurrency('PIX - Recebido\n1.500,00 (+)')).toBe('BRL');
  });

  it.each([
    ['Saldo Anterior', true],
    ['S A L D O', true],
    ['SALDO', true],
    ['Opening Balance', true],
    ['Balance transfer fee', false],
    ['PIX - Recebido', false],
  ])('tells whether %s states a balance', (description, expected) => {
    expect(isBalanceLabel(description)).toBe(expected);
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
    expect(findAccountNumber('Agência: 0001-9 Conta: 10000-1')).toBe('10000-1');
    expect(findAccountNumber('Primary Account: 1234567890')).toBe('1234567890');
    expect(findAccountNumber('MEMBER ONE Acct #1234567890 Page 2 of 2')).toBe('1234567890');
    expect(findAccountNumber('FINANCIAL SUMMARY ACCOUNT# BALANCE')).toBeNull();
  });

  it('reads the statement period in either numeric order or with month names', () => {
    const dayMonth = (date?: Date) => date && [date.getDate(), date.getMonth() + 1];
    const us = findStatementPeriod('Opening/Closing Date 09/01/2025 - 09/30/2025', 'mdy');
    const fr = findStatementPeriod('1 janvier 2025 - 31 janvier 2025', 'dmy');
    expect([dayMonth(us?.from), dayMonth(us?.to)]).toEqual([[1, 9], [30, 9]]);
    expect([dayMonth(fr?.from), dayMonth(fr?.to)]).toEqual([[1, 1], [31, 1]]);
    expect(findStatementPeriod('Due 10/24/2025, issued 09/30/2025', 'mdy')).toBeNull();
    const colons = findStatementPeriod('for the period (From : 23-08-2023 To : 24-01-2024)', 'dmy');
    expect([dayMonth(colons?.from), dayMonth(colons?.to)]).toEqual([[23, 8], [24, 1]]);
  });

  it('reads the period between dated balance rows, for a month without movements', () => {
    const iso = (date?: Date) => date?.toISOString().slice(0, 10);
    const text = [
      'Previous Balance / O/S Balance 1,000.00',
      '2020/09/30 Balance Brought Forward 1,000.00',
      '2020/10/31 Balance Carried Forward 1,000.00',
    ].join('\n');
    const period = findBalanceRowPeriod(text, 'dmy');
    expect([iso(period?.from), iso(period?.to)]).toEqual(['2020-09-30', '2020-10-31']);
    expect(findBalanceRowPeriod('2020/09/30 Balance Brought Forward 1,000.00', 'dmy')).toBeNull();
    expect(
      findBalanceRowPeriod('31/10/2020 Opening Balance 5.00\n30/09/2020 Closing Balance 5.00', 'dmy'),
    ).toBeNull();
  });

  it('reads dates without a year against the statement date, not a date years ahead', () => {
    const statement = [
      'Statement date September 7,2017',
      'Your closing balance on Sep 7, 2017',
      'Payments continue MONTHLY until JUN 13, 2027',
    ].join('\n');
    expect(findStatementAnchor(statement, 'dmy')).toEqual(new Date(2017, 8, 7));
    expect(findStatementAnchor('Printed 05/03/2024, due 20/03/2024', 'dmy')).toEqual(
      new Date(2024, 2, 20),
    );
    expect(findStatementAnchor('No dates here', 'dmy')).toBeNull();
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

  it('reads "balance on <date>", not the figure a box beside it prints on the line', () => {
    const text = [
      'Date of previous statement 19 Jun 2025 Type of Fee Quantity Total',
      'Balance on 20 Jun 2025 £1,000.00 Debit card fee 8 £2.80',
      'Money in £300.00',
      'Money out £50.00',
      'Balance on 20 Jul 2025 £1,250.00 section and on the reverse.',
    ].join('\n');
    expect(findStatementBalances(text, 'dmy')).toEqual({ start: 1000, end: 1250 });
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

  it('tells a totals line from a row, wherever the label stands', () => {
    expect(isTotalsLabel('Total')).toBe(true);
    expect(isTotalsLabel('TRANSACTION TOTAL')).toBe(true);
    expect(isTotalsLabel('Money out:')).toBe(true);
    expect(isTotalsLabel('Card Payment to ACME Store')).toBe(false);
    expect(isTotalsLabel('ACME Totalcare')).toBe(false);
  });
});
