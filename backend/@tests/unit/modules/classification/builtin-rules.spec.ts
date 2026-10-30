import { matchBuiltinRule } from '@/modules/classification/engine/builtin-rules';

const FEES = 'fees';
const INTEREST_INCOME = 'interest_income';
const INTEREST = 'interest';

const row = (counterpartyName: string, paymentPurpose = counterpartyName) => ({
  counterpartyName,
  paymentPurpose,
});

describe('matchBuiltinRule', () => {
  it.each([
    'ECS Txn Chrgs Incl GST',
    'SMS Alerts Chrgs Incl GST',
    'Dr Card Charges ANNUAL 1234XXXXXXXX5678',
    'Account maintenance fee',
    'ATM fee',
    'Kontoführungsentgelt',
    'Комиссия за обслуживание счета',
  ])('files the bank’s own fee "%s" as a fee', text => {
    expect(matchBuiltinRule(row(text), 'expense')).toBe(FEES);
  });

  it.each([
    '000123456789:Int.Pd:01-07-2026 to 30-09-2026',
    'SB Interest',
    'Interest credited',
    'Habenzinsen',
    'Начисление процентов по вкладу',
  ])('files interest the bank paid, "%s", as interest income', text => {
    expect(matchBuiltinRule(row(text), 'income')).toBe(INTEREST_INCOME);
  });

  it.each(['Overdraft interest', 'Finance charge', 'Sollzinsen', 'Проценты по кредиту'])(
    'files interest the bank charged, "%s", as interest',
    text => {
      expect(matchBuiltinRule(row(text), 'expense')).toBe(INTEREST);
    },
  );

  it.each([
    // Shops and people whose names only look like the words.
    'ACME COFFEE',
    'Example Charging Station',
    'School fee',
    'Travel Lodge Example',
    'Member One',
    'UPI/ACME Store/payment',
  ])('leaves "%s" to the person', text => {
    expect(matchBuiltinRule(row(text), 'expense')).toBeNull();
    expect(matchBuiltinRule(row(text), 'income')).toBeNull();
  });

  it('matches only the direction a rule is for', () => {
    expect(matchBuiltinRule(row('Interest credited'), 'expense')).toBeNull();
    expect(matchBuiltinRule(row('SMS Alerts Chrgs'), 'income')).toBeNull();
  });

  it('reads the payment purpose too', () => {
    expect(matchBuiltinRule(row('Example Bank', 'Annual fee'), 'expense')).toBe(FEES);
  });
});
