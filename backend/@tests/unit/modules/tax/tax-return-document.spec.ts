import * as xlsx from 'xlsx';
import {
  type TaxReturnDocumentInput,
  buildFileName,
  buildTaxReturnPdf,
  buildTaxReturnXlsx,
} from '@/modules/tax/tax-return-document';

const INPUT: TaxReturnDocumentInput = {
  jurisdictionName: 'Kazakhstan',
  taxName: 'НДС',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  status: 'draft',
  filedAt: null,
  currency: 'KZT',
  outputTax: 1200,
  inputTax: 500,
  netPayable: 700,
  lines: [
    {
      transactionId: 'a',
      date: '2026-02-10',
      counterparty: 'Magnum',
      direction: 'input',
      currency: 'KZT',
      taxAmount: 500,
      netAmount: 4500,
      exchangeRate: 1,
      taxAmountConverted: 500,
    },
    {
      transactionId: 'b',
      date: '2026-02-11',
      counterparty: 'Polish supplier',
      direction: 'reverse_charge',
      currency: 'EUR',
      taxAmount: 190,
      netAmount: 1000,
      exchangeRate: 500,
      taxAmountConverted: 95000,
    },
  ],
};

const sheetOf = (buffer: Buffer, name: string) => {
  const book = xlsx.read(buffer, { type: 'buffer' });
  return book.Sheets[name];
};

describe('buildFileName', () => {
  it('names the file after the period it covers', () => {
    expect(buildFileName(INPUT, 'pdf')).toBe('tax-return-2026-01-01_2026-03-31.pdf');
  });
});

describe('buildTaxReturnXlsx', () => {
  it('produces a readable workbook with both sheets', () => {
    const book = xlsx.read(buildTaxReturnXlsx(INPUT), { type: 'buffer' });
    expect(book.SheetNames).toEqual(['Summary', 'Lines']);
  });

  it('carries the headline figures', () => {
    const rows = xlsx.utils.sheet_to_json<string[]>(sheetOf(buildTaxReturnXlsx(INPUT), 'Summary'), {
      header: 1,
    });
    const flat = rows.flat().join('|');

    expect(flat).toContain('Output tax');
    expect(flat).toContain('1200.00 KZT');
    expect(flat).toContain('Payable');
  });

  it('labels a negative net as reclaimable', () => {
    const buffer = buildTaxReturnXlsx({ ...INPUT, netPayable: -300 });
    const rows = xlsx.utils.sheet_to_json<string[]>(sheetOf(buffer, 'Summary'), { header: 1 });
    const flat = rows.flat().join('|');

    expect(flat).toContain('Reclaimable');
    // The sign is carried by the label, so the amount itself reads plainly.
    expect(flat).toContain('300.00 KZT');
  });

  it('keeps each line in its own currency alongside the converted figure', () => {
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(
      sheetOf(buildTaxReturnXlsx(INPUT), 'Lines'),
    );

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      Counterparty: 'Polish supplier',
      Kind: 'Reverse charge',
      Currency: 'EUR',
      'Tax amount': 190,
      'Tax in KZT': 95000,
    });
  });

  it('says the period is empty rather than emitting a headerless sheet', () => {
    const buffer = buildTaxReturnXlsx({ ...INPUT, lines: [] });
    const rows = xlsx.utils.sheet_to_json<string[]>(sheetOf(buffer, 'Lines'), { header: 1 });

    expect(rows.flat().join('')).toMatch(/No taxed transactions/);
  });

  it('carries the disclaimer', () => {
    const rows = xlsx.utils.sheet_to_json<string[]>(sheetOf(buildTaxReturnXlsx(INPUT), 'Summary'), {
      header: 1,
    });
    expect(rows.flat().join('|')).toMatch(/Not a substitute for advice/);
  });
});

describe('buildTaxReturnPdf', () => {
  it('produces a real PDF', async () => {
    const buffer = await buildTaxReturnPdf(INPUT);

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('renders an empty period without failing', async () => {
    const buffer = await buildTaxReturnPdf({ ...INPUT, lines: [] });
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('renders a filed return', async () => {
    const buffer = await buildTaxReturnPdf({
      ...INPUT,
      status: 'filed',
      filedAt: '2026-04-05',
    });
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
