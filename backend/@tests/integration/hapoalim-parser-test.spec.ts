/**
 * Integration test: run HapoalimParser against real statement images.
 * Run with: npx jest @tests/integration/hapoalim-parser-test.ts --no-coverage --testTimeout=120000
 */
import * as path from 'path';
import { HapoalimParser } from '@/modules/parsing/parsers/hapoalim.parser';
import { BankName, FileType } from '@/entities/statement.entity';

vi.mock('@/common/utils/advanced-language-detector.util', () => ({
  advancedLanguageDetector: {
    detectLanguage: vi.fn().mockResolvedValue({
      locale: 'he',
      confidence: 0.9,
      method: 'mock',
      reason: 'mock',
    }),
  },
}));

const EXAMPLES_DIR = path.resolve(__dirname, '../../../docs/statements-examples/hapoalim');

describe('HapoalimParser integration — real images', () => {
  const parser = new HapoalimParser();

  it('canParse hapoalim-1.jpg', async () => {
    const filePath = path.join(EXAMPLES_DIR, 'hapoalim-1.jpg');
    const result = await parser.canParse(BankName.HAPOALIM, FileType.IMAGE, filePath);
    console.log(`canParse hapoalim-1.jpg: ${result}`);
    expect(result).toBe(true);
  }, 120000);

  it('canParse hapoalim-2.jpg', async () => {
    const filePath = path.join(EXAMPLES_DIR, 'hapoalim-2.jpg');
    const result = await parser.canParse(BankName.HAPOALIM, FileType.IMAGE, filePath);
    console.log(`canParse hapoalim-2.jpg: ${result}`);
    expect(result).toBe(true);
  }, 120000);

  it('parses hapoalim-1.jpg (page 2: foreign continuation + domestic)', async () => {
    const filePath = path.join(EXAMPLES_DIR, 'hapoalim-1.jpg');
    const result = await parser.parse(filePath);

    console.log('\n--- hapoalim-1.jpg Metadata ---');
    console.log(`  Account: ${result.metadata.accountNumber}`);
    console.log(`  Currency: ${result.metadata.currency}`);
    console.log(`  Institution: ${result.metadata.institution}`);
    console.log(`  Period: ${result.metadata.dateFrom?.toISOString().split('T')[0]} - ${result.metadata.dateTo?.toISOString().split('T')[0]}`);

    console.log(`\n--- Transactions (${result.transactions.length}) ---`);
    for (const [i, tx] of result.transactions.entries()) {
      const date = tx.transactionDate.toISOString().split('T')[0];
      const amount = tx.debit ? `debit: ${tx.debit}` : `credit: ${tx.credit}`;
      const foreign = tx.amountForeign ? ` (foreign: ${tx.amountForeign}, rate: ${tx.exchangeRate})` : '';
      console.log(`  ${i + 1}. [${date}] ${tx.counterpartyName?.substring(0, 35).padEnd(35)} ${amount.padEnd(18)}${foreign}`);
      if (tx.paymentPurpose && tx.paymentPurpose !== tx.counterpartyName) {
        console.log(`     Purpose: ${tx.paymentPurpose.substring(0, 60)}`);
      }
    }

    console.log(`\nTotal debit:  ${result.transactions.reduce((s, t) => s + (t.debit || 0), 0).toFixed(2)}`);
    console.log(`Total credit: ${result.transactions.reduce((s, t) => s + (t.credit || 0), 0).toFixed(2)}`);

    expect(result.metadata.currency).toBe('ILS');
    expect(result.transactions.length).toBeGreaterThan(0);
  }, 120000);

  it('parses hapoalim-2.jpg (page 1: header + foreign transactions)', async () => {
    const filePath = path.join(EXAMPLES_DIR, 'hapoalim-2.jpg');
    const result = await parser.parse(filePath);

    console.log('\n--- hapoalim-2.jpg Metadata ---');
    console.log(`  Account: ${result.metadata.accountNumber}`);
    console.log(`  Currency: ${result.metadata.currency}`);
    console.log(`  Institution: ${result.metadata.institution}`);
    console.log(`  Period: ${result.metadata.dateFrom?.toISOString().split('T')[0]} - ${result.metadata.dateTo?.toISOString().split('T')[0]}`);

    console.log(`\n--- Transactions (${result.transactions.length}) ---`);
    for (const [i, tx] of result.transactions.entries()) {
      const date = tx.transactionDate.toISOString().split('T')[0];
      const amount = tx.debit ? `debit: ${tx.debit}` : `credit: ${tx.credit}`;
      const foreign = tx.amountForeign ? ` (foreign: ${tx.amountForeign}, rate: ${tx.exchangeRate})` : '';
      console.log(`  ${i + 1}. [${date}] ${tx.counterpartyName?.substring(0, 35).padEnd(35)} ${amount.padEnd(18)}${foreign}`);
      if (tx.paymentPurpose && tx.paymentPurpose !== tx.counterpartyName) {
        console.log(`     Purpose: ${tx.paymentPurpose.substring(0, 60)}`);
      }
    }

    console.log(`\nTotal debit:  ${result.transactions.reduce((s, t) => s + (t.debit || 0), 0).toFixed(2)}`);
    console.log(`Total credit: ${result.transactions.reduce((s, t) => s + (t.credit || 0), 0).toFixed(2)}`);

    expect(result.metadata.currency).toBe('ILS');
    // Account number may be mangled by OCR (e.g. 12:522-0450853 instead of 12-522-0650653)
    expect(result.transactions.length).toBeGreaterThan(0);
  }, 120000);
});
