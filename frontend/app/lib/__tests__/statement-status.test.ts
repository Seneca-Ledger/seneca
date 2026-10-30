import { describe, expect, it } from 'vitest';

import {
  getStatementDisplayMerchant,
  getStatementMerchantLabel,
  hasProcessingStatements,
  isManualExpenseStatement,
  isStatementProcessingStatus,
} from '../statement-status';

describe('statement status helpers', () => {
  it('marks uploaded and processing as in-progress statuses', () => {
    expect(isStatementProcessingStatus('uploaded')).toBe(true);
    expect(isStatementProcessingStatus('processing')).toBe(true);
  });

  it('does not treat parsed/completed/error as in-progress', () => {
    expect(isStatementProcessingStatus('parsed')).toBe(false);
    expect(isStatementProcessingStatus('completed')).toBe(false);
    expect(isStatementProcessingStatus('error')).toBe(false);
  });

  it('detects when list contains at least one in-progress statement', () => {
    expect(hasProcessingStatements([{ status: 'completed' }, { status: 'uploaded' }])).toBe(true);
  });

  it('returns false when list has no in-progress statements', () => {
    expect(
      hasProcessingStatements([{ status: 'parsed' }, { status: 'completed' }, { status: null }]),
    ).toBe(false);
  });

  it('returns scanning label while statement is processing', () => {
    expect(getStatementMerchantLabel('processing', 'Kaspi', 'Scanning...')).toBe('Scanning...');
  });

  it('returns merchant label after processing is completed', () => {
    expect(getStatementMerchantLabel('completed', 'Kaspi', 'Scanning...')).toBe('Kaspi');
  });

  it('detects manual expense statements by parsing metadata', () => {
    expect(
      isManualExpenseStatement({
        parsingDetails: {
          detectedBy: 'manual-expense',
        },
      }),
    ).toBe(true);
    expect(
      isManualExpenseStatement({
        parsingDetails: {
          importPreview: { source: 'manual-expense' },
        },
      }),
    ).toBe(true);
    expect(isManualExpenseStatement({ parsingDetails: null })).toBe(false);
  });

  it('prefers manual merchant from parsing metadata', () => {
    expect(
      getStatementDisplayMerchant(
        {
          parsingDetails: {
            importPreview: { merchant: 'Coffee point' },
          },
        },
        'Other',
      ),
    ).toBe('Coffee point');
  });

  it('falls back to bank label when manual merchant is missing', () => {
    expect(getStatementDisplayMerchant({ parsingDetails: null }, 'Kaspi')).toBe('Kaspi');
  });

  it('names a statement of a bank no parser knows by the bank name taught for it', () => {
    const taught = { parsingDetails: { metadataExtracted: { institution: 'Northwind Mutual' } } };
    expect(getStatementDisplayMerchant({ ...taught, bankName: 'other' }, 'Other')).toBe(
      'Northwind Mutual',
    );
    // A bank with a parser of its own keeps its own name.
    expect(getStatementDisplayMerchant({ ...taught, bankName: 'axis' }, 'Axis Bank')).toBe(
      'Axis Bank',
    );
  });
});
