import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findDocumentDate } from '@/common/utils/document-date.util';

const isoOf = (text: string, options = {}) =>
  findDocumentDate(text, options)?.date.toISOString().slice(0, 10);

describe('findDocumentDate', () => {
  describe('real invoices', () => {
    // pdf-parse output with the label glued to its value ("Date of issueJune 21, 2026").
    const invoice = (name: string) =>
      readFileSync(join(__dirname, '../../modules/parsing/fixtures/invoices', name), 'utf8');

    it.each([
      ['captions-invoice.txt', '2026-06-21'],
      ['anthropic-receipt.txt', '2026-09-21'],
    ])('reads the date of %s', (file, iso) => {
      expect(isoOf(invoice(file))).toBe(iso);
    });

    it('reads the date pdf-parse produces once the NUL separators are gone', () => {
      const text = invoice('captions-invoice.txt').replace(/\0/g, '');

      expect(isoOf(text)).toBe('2026-06-21');
    });
  });

  describe('labels', () => {
    it('prefers the date paid over the date of issue', () => {
      const text = ['Date of issue June 1, 2026', 'Date paid June 5, 2026'].join('\n');

      expect(isoOf(text)).toBe('2026-06-05');
    });

    it('prefers a labelled date over an unlabelled one that comes first', () => {
      const text = ['Ref ABC 12.05.2026', 'Invoice date: 14.05.2026'].join('\n');

      expect(isoOf(text)).toBe('2026-05-14');
    });

    it.each([
      ['Due date: 30.06.2026\nTotal 10.00'],
      ['$24.99 USD due June 21, 2026'],
      ['Отчет сформирован пользователем 26.11.2025 9:18'],
      ['Billing period 01.06.2026'],
      ['Fällig am 30.06.2026'],
    ])('never takes a due date, a period or a print date: %s', text => {
      expect(findDocumentDate(text)).toBeUndefined();
    });

    it('skips the due date on a line that also has the issue date', () => {
      expect(isoOf('Date: 01.06.2026 Due: 15.06.2026')).toBe('2026-06-01');
    });

    it('takes the label from the line above when the date stands alone', () => {
      const text = ['Due date', '30.06.2026', 'Datum', '02.06.2026'].join('\n');

      expect(isoOf(text)).toBe('2026-06-02');
    });

    it('does not take the end of a service period', () => {
      expect(findDocumentDate('Jun 21 Jul 21, 2026')).toBeUndefined();
      expect(findDocumentDate('Jun 21 – Jul 21, 2026')).toBeUndefined();
    });
  });

  describe('formats', () => {
    it.each([
      ['Date: June 21, 2026', '2026-06-21'],
      ['Date: Jun 21st 2026', '2026-06-21'],
      ['Дата: 21 июня 2026 г.', '2026-06-21'],
      ['Rechnungsdatum: 21. Juni 2026', '2026-06-21'],
      ['Fecha: 21 de junio de 2026', '2026-06-21'],
      ['Data: 21 czerwca 2026', '2026-06-21'],
      ['Дата: 21 червня 2026', '2026-06-21'],
      ['Date: 21 juin 2026', '2026-06-21'],
      ['Date: 2026-06-21', '2026-06-21'],
      ['Date: 21.06.2026', '2026-06-21'],
      ['Date: 21/06/2026', '2026-06-21'],
      ['Datum 21.06.26 14:33', '2026-06-21'],
      ['Date: 6/21/2026', '2026-06-21'],
    ])('reads "%s"', (text, iso) => {
      expect(isoOf(text)).toBe(iso);
    });

    it('is a calendar date, whatever the server time zone', () => {
      expect(findDocumentDate('Date: 21.06.2026')?.date.toISOString()).toBe(
        '2026-06-21T00:00:00.000Z',
      );
    });

    it('does not read a month inside another word', () => {
      expect(findDocumentDate('Kumar 21, 2026')).toBeUndefined();
    });

    it.each([
      ['Date: 31.02.2026'],
      ['Date: 11.11.9301'],
      ['Ref 111.11.93011'],
      ['Phone 053-5000369'],
    ])('ignores what is not a real date: %s', text => {
      expect(findDocumentDate(text)).toBeUndefined();
    });
  });

  describe('day or month first', () => {
    it('settles the order when one number cannot be a month', () => {
      expect(findDocumentDate('Date: 13/06/2026', { monthFirst: true })).toEqual({
        date: new Date('2026-06-13'),
        ambiguous: false,
      });
    });

    it('reads an ambiguous date day first unless told otherwise, and says so', () => {
      expect(findDocumentDate('תאריך 08/07/2026')).toEqual({
        date: new Date('2026-07-08'),
        ambiguous: true,
      });
      expect(isoOf('Date: 08/07/2026', { monthFirst: true })).toBe('2026-08-07');
    });
  });
});
