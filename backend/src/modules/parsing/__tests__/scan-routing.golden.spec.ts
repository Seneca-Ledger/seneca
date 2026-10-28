import * as path from 'path';
import { isBankStatementScan } from '../helpers/scan-statement.helper';
import { ParserFactoryService } from '../services/parser-factory.service';

const backendRoot = path.resolve(__dirname, '../../../..');

/** Statements from the golden corpus and e-invoices from the e-invoice fixtures. */
const STATEMENTS = [
  'golden/absa/sample1.pdf',
  'golden/ally/sample1.pdf',
  'golden/anz/sample1.pdf',
  'golden/associated/sample1.pdf',
  'golden/atb/sample1.pdf',
  'golden/axis/sample1.pdf',
  'golden/banco-do-brasil/sample1.pdf',
  'golden/bank-of-china/sample1.pdf',
  'golden/bank-of-scotland/sample1.pdf',
  'golden/bereke/sample1.pdf',
  'golden/kaspi/sample1.pdf',
  'golden/bsb/bsb-001.pdf',
  'golden/bsb/bsb-002.pdf',
  'golden/bsb/bsb-004.pdf',
];
const INVOICES = [
  '@tests/fixtures/e-invoices/zugferd/EN16931_Einfach.pdf',
  '@tests/fixtures/e-invoices/zugferd/EN16931_Innergemeinschaftliche_Lieferungen.pdf',
  '@tests/fixtures/e-invoices/zugferd/EN16931_Gutschrift.pdf',
  '@tests/fixtures/e-invoices/zugferd/XRECHNUNG_Einfach.pdf',
];

describe('scan routing (optional)', () => {
  const goldenEnabled = process.env.GOLDEN_ENABLED === '1' || process.env.GOLDEN_ENABLED === 'true';
  if (!goldenEnabled) {
    it.skip('set GOLDEN_ENABLED=1 to run scan routing checks', () => {});
    return;
  }

  const factory = new ParserFactoryService();
  const scan = (relative: string) =>
    isBankStatementScan(
      {
        path: path.join(backendRoot, relative),
        mimetype: 'application/pdf',
        originalname: path.basename(relative),
      },
      factory,
    );

  it.each(STATEMENTS)('parses %s as a statement', async file => {
    await expect(scan(file)).resolves.toBe(true);
  }, 30_000);

  it.each(INVOICES)('books %s as a receipt', async file => {
    await expect(scan(file)).resolves.toBe(false);
  }, 30_000);
});
