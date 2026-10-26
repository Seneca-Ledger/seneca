import { readBalanceHistoryFile } from '@/modules/balance/balance-history-file';
import { BadRequestException } from '@nestjs/common';

const csv = (text: string) => Buffer.from(text, 'utf8');

describe('readBalanceHistoryFile', () => {
  it('reads a plain date and amount export', () => {
    const rows = readBalanceHistoryFile(
      csv('Date,Balance\n2026-01-10,1000\n2026-02-10,1250.50\n'),
    );

    expect(rows).toEqual([
      { date: '2026-01-10', amount: 1000, currency: undefined },
      { date: '2026-02-10', amount: 1250.5, currency: undefined },
    ]);
  });

  it('takes the day the file says, whatever the timezone', () => {
    const rows = readBalanceHistoryFile(csv('Дата,Сумма,Валюта\n10.01.2026,"1 234,56",EUR\n'));

    expect(rows).toEqual([{ date: '2026-01-10', amount: 1234.56, currency: 'EUR' }]);
  });

  it('skips the note at the bottom instead of refusing the whole file', () => {
    const rows = readBalanceHistoryFile(
      csv('Date,Amount\n2026-01-10,1000\nExported from Mint,\n'),
    );

    expect(rows).toEqual([{ date: '2026-01-10', amount: 1000, currency: undefined }]);
  });

  it('says what the file is missing when there is no amount column', () => {
    expect(() => readBalanceHistoryFile(csv('Date,Note\n2026-01-10,hello\n'))).toThrow(
      BadRequestException,
    );
  });

  it('refuses a file with no dated amounts in it at all', () => {
    expect(() => readBalanceHistoryFile(csv('Date,Amount\nnot a date,not a number\n'))).toThrow(
      BadRequestException,
    );
  });
});
