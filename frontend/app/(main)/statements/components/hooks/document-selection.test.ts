import { describe, expect, it } from 'vitest';
import {
  acceptsDocuments,
  documentCategory,
  groupByCategory,
  tableStatementIds,
} from './document-selection';

const GROCERIES = { id: 'cat-groceries', name: 'Groceries' };
const TRAVEL = { id: 'cat-travel', name: 'Travel' };

describe('documentCategory', () => {
  it('reads the resolved category first, then the parsed one', () => {
    expect(documentCategory({ category: GROCERIES })).toEqual(GROCERIES);
    expect(
      documentCategory({ parsedData: { categoryId: TRAVEL.id, category: TRAVEL.name } }),
    ).toEqual(TRAVEL);
  });

  it('treats the Uncategorized fallback and a bare id as no category', () => {
    expect(documentCategory({ category: { id: 'cat-x', name: 'Uncategorized' } })).toBeNull();
    expect(documentCategory({ parsedData: { categoryId: 'cat-x' } })).toBeNull();
    expect(documentCategory({})).toBeNull();
  });
});

describe('groupByCategory', () => {
  it('groups documents by category, largest first, no category last', () => {
    const buckets = groupByCategory([
      { id: 'doc-1', category: TRAVEL },
      { id: 'doc-2' },
      { id: 'doc-3', category: GROCERIES },
      { id: 'doc-4', category: GROCERIES },
    ]);
    expect(buckets).toEqual([
      { id: GROCERIES.id, name: GROCERIES.name, documentIds: ['doc-3', 'doc-4'] },
      { id: TRAVEL.id, name: TRAVEL.name, documentIds: ['doc-1'] },
      { id: null, name: null, documentIds: ['doc-2'] },
    ]);
  });
});

describe('tableStatementIds', () => {
  it('takes a statement as is, a scan by its hidden statement and skips a scan without one', () => {
    expect(
      tableStatementIds([
        { id: 'stmt-1', source: 'statement' },
        { id: 'receipt-1', source: 'scan', statementId: 'stmt-of-scan' },
        { id: 'receipt-2', source: 'scan', statementId: null },
        { id: 'stmt-1' },
      ]),
    ).toEqual(['stmt-1', 'stmt-of-scan']);
  });
});

describe('acceptsDocuments', () => {
  const bound = (filters: Record<string, unknown>) => ({
    sourceBinding: { kind: 'transactions', filters },
  });

  it('accepts only a transactions table built from documents', () => {
    expect(acceptsDocuments(bound({ statementIds: ['stmt-1'] }))).toBe(true);
    expect(acceptsDocuments(bound({ dateFrom: '2026-09-01' }))).toBe(false);
    expect(acceptsDocuments(bound({ statementIds: ['stmt-1'], ids: ['tx-1'] }))).toBe(false);
    expect(
      acceptsDocuments({ sourceBinding: { kind: 'invoices', filters: { statementIds: [] } } }),
    ).toBe(false);
    expect(acceptsDocuments({ sourceBinding: null })).toBe(false);
  });
});
