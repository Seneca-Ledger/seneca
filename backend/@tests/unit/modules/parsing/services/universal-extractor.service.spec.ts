import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentClassifierService } from '@/modules/parsing/services/document-classifier.service';
import { OcrService } from '@/modules/parsing/services/ocr.service';
import { TransactionTypeDetectorService } from '@/modules/parsing/services/transaction-type-detector.service';
import { UniversalAmountParser } from '@/modules/parsing/services/universal-amount-parser.service';
import { UniversalExtractorService } from '@/modules/parsing/services/universal-extractor.service';

describe('UniversalExtractorService', () => {
  let service: UniversalExtractorService;

  beforeEach(() => {
    service = new UniversalExtractorService(
      new UniversalAmountParser(),
      new TransactionTypeDetectorService(),
      new DocumentClassifierService(),
      new OcrService(),
    );
  });

  describe('extractFromText', () => {
    it('extracts amount and expense type from receipt text', async () => {
      const text = 'Payment Receipt\nStore ABC\nItem 1  $10.00\nItem 2  $20.49\nTotal: $30.49';
      const result = await service.extractFromText(text);

      expect(result.totalAmount).toBe(30.49);
      expect(result.currency).toBe('USD');
      expect(result.transactionType).toBe('expense');
      expect(result.documentType).toBe('receipt');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('extracts amount from Russian receipt text', async () => {
      const text = 'Кассовый чек\nМагазин Продукты\nМолоко  500\nХлеб  200\nИтого: 700 KZT';
      const result = await service.extractFromText(text);

      expect(result.totalAmount).toBe(700);
      expect(result.currency).toBe('KZT');
      expect(result.transactionType).toBe('expense');
    });

    it('detects refund as income', async () => {
      const text = 'Refund Confirmation\nRefund Amount: $25.00\nCredited to Visa ****1234';
      const result = await service.extractFromText(text);

      expect(result.totalAmount).toBe(25);
      expect(result.transactionType).toBe('income');
    });

    it('returns unknown for empty text', async () => {
      const result = await service.extractFromText('');

      expect(result.documentType).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('extracts vendor from top receipt lines', async () => {
      const text = 'Starbucks Coffee\n1234 Main St\nLatte  $5.50\nTotal: $5.50';
      const result = await service.extractFromText(text);

      expect(result.vendor).toBeTruthy();
    });

    it('skips a page-number line when picking the vendor', async () => {
      const text = '1 / 4\nWise ILS LTD\n121 Menachem Begin Street\nTotal: 8,36 EUR';
      const result = await service.extractFromText(text);

      expect(result.vendor).toBe('Wise ILS LTD');
    });

    it.each([
      'DESCRIPTION PRICE DURATION QTY AMOUNT',
      'DESCRIPTIONPRICEDURATIONQTYAMOUNT',
    ])('skips the column-header line "%s" when picking the vendor', async header => {
      const text = `${header}\nSpaceship Inc\nFinal cost $9.08`;
      const result = await service.extractFromText(text);

      expect(result.vendor).toBe('Spaceship Inc');
    });

    it('keeps an uppercase merchant name as the vendor', async () => {
      const text = 'AMAZON EU SARL\n12.09.2026\nTotal: 23,99 EUR';
      const result = await service.extractFromText(text);

      expect(result.vendor).toBe('AMAZON EU SARL');
      expect(result.totalAmount).toBe(23.99);
    });

    it('prefers a Cyrillic total line over a larger glued table number', async () => {
      // pdf-parse glues the "times used / times charged / fee" columns: "1", "0", "0 EUR" -> "100 EUR".
      const text = [
        '1 / 4',
        'Wise ILS LTD',
        'Выписка по комиссиям',
        'Комиссия за пополнение11',
        '8,36 ',
        'EUR',
        'Комиссия за перемещение100 EUR',
        'Комиссия за снятие наличных в банкомате000 EUR',
        'Общая сумма заплаченных комиссий8,36 EUR',
      ].join('\n');
      const result = await service.extractFromText(text);

      expect(result.totalAmount).toBe(8.36);
      expect(result.currency).toBe('EUR');
    });

    it('extracts the store address from a CIS receipt header', async () => {
      const text = 'ТОО Magnum\nг. Алматы, ул. Абая 10\nМолоко 450\nИТОГО 450';
      const result = await service.extractFromText(text);

      expect(result.merchantAddress).toBe('г. Алматы, ул. Абая 10');
    });

    it('populates field confidence', async () => {
      const text = 'Receipt\nStore XYZ\nTotal: $45.99\nTax: $3.50';
      const result = await service.extractFromText(text);

      expect(result.fieldConfidence).toBeDefined();
      expect(result.fieldConfidence.totalAmount).toBeGreaterThan(0);
    });

    it('extracts a receipt date', async () => {
      const text = 'Receipt\nStore ABC\nDate: 26.11.2025\nTotal: $10.00';
      const result = await service.extractFromText(text);

      expect(result.date?.toISOString()).toBe('2025-11-26T00:00:00.000Z');
    });

    it('reads the date of an invoice whose label is glued to it', async () => {
      const text = ['Invoice', 'Date of issueJune 21, 2026', 'Date dueJuly 5, 2026', 'Total $24.99'];
      const result = await service.extractFromText(text.join('\n'));

      expect(result.date?.toISOString().slice(0, 10)).toBe('2026-06-21');
      expect(result.fieldConfidence.date).toBe(0.8);
    });

    it('reads an ambiguous date day first when no currency is stated', async () => {
      const result = await service.extractFromText('Invoice\nStore ABC\nDate: 08/07/2026\nTotal: 10.00');

      expect(result.date?.toISOString().slice(0, 10)).toBe('2026-07-08');
    });

    it('reads an ambiguous date month first on a dollar receipt, with less confidence', async () => {
      const result = await service.extractFromText('Receipt\nStore ABC\nDate: 07/08/2026\nTotal: $10.00');

      expect(result.date?.toISOString().slice(0, 10)).toBe('2026-07-08');
      expect(result.fieldConfidence.date).toBe(0.5);
    });

    it('ignores a date with an implausible year', async () => {
      const text = 'Receipt\nStore ABC\n11.11.9301\nTotal: $10.00';
      const result = await service.extractFromText(text);

      expect(result.date).toBeUndefined();
    });

    it('ignores a date-looking substring inside a longer digit run', async () => {
      const text = 'Receipt\nStore ABC\nRef 111.11.93011\nTotal: $10.00';
      const result = await service.extractFromText(text);

      expect(result.date).toBeUndefined();
    });

    it('captures validation issue when subtotal plus tax does not match total', async () => {
      const text = 'Receipt\nSubtotal: $40.00\nTax: $5.00\nTotal: $50.00';
      const result = await service.extractFromText(text);

      if (result.subtotal && result.tax && result.totalAmount) {
        const expected = result.subtotal + result.tax;
        if (Math.abs(expected - result.totalAmount) > 0.01) {
          expect(result.validationIssues.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('line items', () => {
    it('keeps items that add up to the total', async () => {
      const text = 'Payment Receipt\nStore ABC\nItem 1  $10.00\nItem 2  $20.49\nTotal: $30.49';
      const result = await service.extractFromText(text);

      expect(result.lineItems).toEqual([
        { description: 'Item 1', amount: 10 },
        { description: 'Item 2', amount: 20.49 },
      ]);
    });

    it.each([
      'railway-invoice.txt',
      'anthropic-invoice.txt',
      'anthropic-receipt.txt',
      'captions-invoice.txt',
      'anomaly-invoice.txt',
    ])('drops the page numbers, dates and postcodes %s yields as items', async file => {
      const text = readFileSync(join(__dirname, '../fixtures/invoices', file), 'utf8');
      const result = await service.extractFromText(text);

      expect(result.lineItems).toEqual([]);
      expect(result.fieldConfidence.lineItems).toBe(0);
      expect(result.validationIssues.join(' ')).toContain('line items dropped');
      // The total is untouched: only the items were wrong.
      expect(result.totalAmount).toBeGreaterThan(0);
    });
  });

  describe('the vendor of an invoice', () => {
    // pdf-parse output of real invoices, with the buyer's details replaced. The
    // label and its value arrive glued ("Invoice number29556044 0015"), which is
    // what used to be taken for the vendor.
    const invoice = (name: string) =>
      readFileSync(join(__dirname, '../fixtures/invoices', name), 'utf8');

    it.each([
      ['railway-invoice.txt', 'Railway Corporation'],
      ['captions-invoice.txt', 'Captions (captions.ai)'],
      ['anthropic-invoice.txt', 'Anthropic, PBC'],
      ['anomaly-invoice.txt', 'Anomaly'],
      ['anthropic-receipt.txt', 'Anthropic, PBC'],
    ])('reads the issuer of %s, not its number', async (file, vendor) => {
      const result = await service.extractFromText(invoice(file));

      expect(result.vendor).toBe(vendor);
    });

    it('never takes the "Bill to" party, which is the user', async () => {
      const text = ['Invoice', 'Invoice No. 4711', 'Bill to', 'Jane Doe', 'Total: $10.00'].join('\n');

      const result = await service.extractFromText(text);

      expect(result.vendor).toBeUndefined();
    });

    it.each([
      ['From: Hetzner Online GmbH', 'Hetzner Online GmbH'],
      ['Seller', 'Hetzner Online GmbH'],
      ['Продавец: ТОО Ромашка', 'ТОО Ромашка'],
    ])('follows the seller label in "%s"', async (label, vendor) => {
      const lines = label.includes(':') ? [label] : [label, vendor];
      const text = ['Rechnung', 'Kundennummer 0042', ...lines, 'Total: 10,00 EUR'].join('\n');

      const result = await service.extractFromText(text);

      expect(result.vendor).toBe(vendor);
    });
  });
});
