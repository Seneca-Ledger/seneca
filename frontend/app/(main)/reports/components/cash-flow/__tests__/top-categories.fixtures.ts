import type { StatementListItem, TransactionListPage } from '@/app/lib/contracts';
import { transactionItem } from '@/app/test/fixtures/contracts';

/*
 * What the analytics loader fetches for February 2026: one statement, one
 * confirmed transaction and two approved receipts, one of them the
 * transaction's own. Statements and transactions are shaped like their
 * StatementListPage and TransactionListPage contracts, which the loader checks.
 */

const STATEMENTS: StatementListItem[] = [
  {
    id: 'statement-1',
    fileName: 'statement-february.pdf',
    fileType: 'pdf',
    bankName: 'Example Bank',
    status: 'completed',
    stage: 'submit',
    errorMessage: null,
    totalTransactions: 1,
    totalDebit: '320',
    totalCredit: '0',
    balanceStart: null,
    balanceEnd: null,
    currency: 'USD',
    statementDateFrom: '2026-02-01',
    statementDateTo: '2026-02-10',
    createdAt: '2026-02-10T00:00:00.000Z',
    updatedAt: '2026-02-10T00:00:00.000Z',
    processedAt: null,
    categoryId: null,
    category: null,
    tags: [],
    user: null,
    parsingDetails: null,
    transactionSummary: {
      description: null,
      exchangeRate: null,
      exchangeRateMixed: false,
      cardLabel: null,
    },
  },
];

// The list adds the reimbursed row's id to the transaction's own fields.
const TRANSACTIONS: TransactionListPage['data'] = [
  {
    reimbursementOf: null,
    ...transactionItem({
      id: 'tx-1',
      statementId: 'statement-1',
      transactionDate: '2026-02-10',
      debit: '320',
      amount: '-320',
      counterpartyName: 'ACME Software',
      paymentPurpose: 'ACME Software - Team plan',
      isVerified: true,
      categoryId: 'cat-1',
      category: { id: 'cat-1', name: 'Software', isEnabled: true, isSystem: false, source: 'user' },
    }),
  },
];

const RECEIPTS = [
  {
    id: 'receipt-1',
    subject: 'Travel receipt',
    sender: 'Metro Cab <noreply@example.com>',
    receivedAt: '2026-02-12T00:00:00.000Z',
    status: 'approved',
    transactionId: null,
    parsedData: {
      amount: 45,
      currency: 'USD',
      vendor: 'Metro Cab',
      date: '2026-02-12',
      category: 'Travel',
      categoryId: 'cat-2',
      transactionType: 'expense',
    },
  },
  {
    id: 'receipt-2',
    subject: 'Duplicate software receipt',
    sender: 'ACME Software <billing@example.com>',
    receivedAt: '2026-02-13T00:00:00.000Z',
    status: 'approved',
    transactionId: 'tx-1',
    parsedData: {
      amount: 320,
      currency: 'USD',
      vendor: 'ACME Software',
      date: '2026-02-13',
      category: 'Software',
      categoryId: 'cat-1',
      transactionType: 'expense',
    },
  },
];

type Page<T> = { data: T[]; items: T[]; total: number; page: number; limit: number };

function page<T>(items: T[]): Page<T> {
  return { data: items, items, total: items.length, page: 1, limit: 500 };
}

/** The mocked `apiClient.get` for the loader's three endpoints. */
export function analyticsResponse(url: string): Promise<unknown> {
  if (url === '/statements') {
    return Promise.resolve({ data: page(STATEMENTS) });
  }
  if (url === '/transactions') {
    return Promise.resolve({ data: page(TRANSACTIONS) });
  }
  if (url === '/receipts/documents') {
    return Promise.resolve({ data: { receipts: RECEIPTS, total: RECEIPTS.length } });
  }
  return Promise.reject(new Error(`Unhandled request: ${url}`));
}
