import { describe, expect, it } from 'vitest';
import {
  buildStatementRequestParams,
  deriveVisibleFilterScreens,
  isReceiptDerivedStatement,
  paginateStatements,
  reconcileFiltersWithColumns,
  resolvePendingReview,
  resolveStatementViewAction,
} from './StatementsListView.utils';
import { DEFAULT_STATEMENT_FILTERS } from './filters/statement-filters';

describe('StatementsListView utils', () => {
  it('builds statement request params from search and applied filters without server pagination', () => {
    const result = buildStatementRequestParams({
      appliedFilters: {
        ...DEFAULT_STATEMENT_FILTERS,
        type: 'pdf',
        statuses: ['processing'],
        date: { mode: 'on', date: '2026-03-01' },
        keywords: 'alex',
        amountMin: 10,
        approved: true,
        groupBy: 'amount',
        has: ['errors'],
        currencies: ['KZT'],
        exported: false,
        limit: 25,
      },
      search: '',
    });

    expect(result).toEqual({
      type: 'pdf',
      statuses: ['processing'],
      dateMode: 'on',
      dateFrom: '2026-03-01',
      keywords: 'alex',
      amountMin: 10,
      limit: 25,
      approved: true,
      groupBy: 'amount',
      has: ['errors'],
      currencies: ['KZT'],
      exported: false,
    });
  });

  it('omits ui-only receipt source types from server request params', () => {
    const result = buildStatementRequestParams({
      appliedFilters: {
        ...DEFAULT_STATEMENT_FILTERS,
        type: 'receipt',
        statuses: ['processing'],
      },
      search: '',
    });

    expect(result).toEqual({
      statuses: ['processing'],
    });
  });

  it('omits gmail from server request params because gmail receipts are loaded separately', () => {
    const result = buildStatementRequestParams({
      appliedFilters: {
        ...DEFAULT_STATEMENT_FILTERS,
        type: 'gmail',
        statuses: ['processing'],
      },
      search: '',
    });

    expect(result).toEqual({
      statuses: ['processing'],
    });
  });

  it('includes route category filters in server request params', () => {
    const result = buildStatementRequestParams({
      appliedFilters: DEFAULT_STATEMENT_FILTERS,
      categoryId: 'uncategorized',
      search: '',
    });

    expect(result).toEqual({
      categoryId: 'uncategorized',
    });
  });

  it('omits ui-only receipt and gmail bank filters from server request params', () => {
    const result = buildStatementRequestParams({
      appliedFilters: {
        ...DEFAULT_STATEMENT_FILTERS,
        from: ['bank:receipt', 'bank:gmail', 'bank:kaspi', 'user:user-1'],
        to: ['bank:receipt', 'user:user-2'],
      },
      search: '',
    });

    expect(result).toEqual({
      from: ['bank:kaspi', 'user:user-1'],
      to: ['user:user-2'],
    });
  });

  it('treats receipt-scan statement rows as derived even when source is missing', () => {
    expect(
      isReceiptDerivedStatement({
        parsingDetails: {
          detectedBy: 'receipt-scan',
          importPreview: {
            source: 'receipt-scan',
          },
        },
      }),
    ).toBe(true);
  });

  it('does not treat regular statement rows as derived receipt scans', () => {
    expect(
      isReceiptDerivedStatement({
        parsingDetails: {
          detectedBy: 'bank-statement',
          importPreview: {
            source: 'statement-upload',
          },
        },
      }),
    ).toBe(false);
  });

  it('routes local store receipts to the dedicated receipt details page', () => {
    expect(
      resolveStatementViewAction({
        id: 'receipt-1',
        statementId: 'statement-1',
        source: 'scan',
        status: 'draft',
      }),
    ).toEqual({
      type: 'route',
      href: '/storage/receipts/receipt-1',
    });
  });

  it('keeps gmail receipts routed to gmail receipt details', () => {
    expect(
      resolveStatementViewAction({
        id: 'gmail-1',
        source: 'gmail',
        status: 'draft',
      }),
    ).toEqual({
      type: 'route',
      href: '/storage/gmail-receipts/gmail-1',
    });
  });

  it('routes a needs_review statement to the edit page where it can be confirmed', () => {
    expect(
      resolveStatementViewAction({
        id: 'statement-1',
        source: 'statement',
        status: 'needs_review',
      }),
    ).toEqual({
      type: 'route',
      href: '/statements/statement-1/edit',
    });
  });

  it('still routes an unparsed statement to storage', () => {
    expect(
      resolveStatementViewAction({
        id: 'statement-2',
        source: 'statement',
        status: 'uploaded',
      }),
    ).toEqual({
      type: 'route',
      href: '/storage/statement-2',
    });
  });

  it('paginates filtered statements on the client', () => {
    const result = paginateStatements(
      [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
      2,
      2,
    );

    expect(result).toEqual([{ id: '3' }, { id: '4' }]);
  });

  it('derives visible filter screens from currently visible columns', () => {
    const result = deriveVisibleFilterScreens([
      { id: 'receipt', visible: true },
      { id: 'amount', visible: true },
      { id: 'approved', visible: false },
    ]);

    expect(result).toEqual([
      'amount',
      'date',
      'groupBy',
      'has',
      'keywords',
      'limit',
      'status',
      'type',
    ]);
  });

  it('reconciles applied and draft filters when columns hide optional filters', () => {
    const result = reconcileFiltersWithColumns({
      columns: [
        { id: 'receipt', label: 'Receipt', visible: true, order: 0 },
        { id: 'amount', label: 'Amount', visible: false, order: 2 },
        { id: 'approved', label: 'Approved', visible: false, order: 3 },
      ],
      appliedFilters: {
        ...DEFAULT_STATEMENT_FILTERS,
        amountMin: 10,
        amountMax: 100,
        approved: true,
        keywords: 'keep',
      },
      draftFilters: {
        ...DEFAULT_STATEMENT_FILTERS,
        amountMin: 10,
        amountMax: 100,
        approved: true,
        keywords: 'keep',
      },
    });

    expect(result.allowedFilterKeys).toEqual([
      'date',
      'exported',
      'groupBy',
      'has',
      'keywords',
      'limit',
      'paid',
      'statuses',
      'type',
    ]);
    expect(result.nextAppliedFilters).toEqual({
      ...DEFAULT_STATEMENT_FILTERS,
      keywords: 'keep',
    });
    expect(result.nextDraftFilters).toEqual({
      ...DEFAULT_STATEMENT_FILTERS,
      keywords: 'keep',
    });
  });

  describe('resolvePendingReview', () => {
    const counts = { 'statement-1': 3 };

    it("counts a statement's rows still waiting in Review", () => {
      expect(resolvePendingReview({ id: 'statement-1', status: 'completed' }, false, counts)).toBe(3);
      expect(resolvePendingReview({ id: 'statement-2', status: 'completed' }, false, counts)).toBe(0);
    });

    it('counts a receipt as one until it is approved, rejected or failed', () => {
      for (const status of ['new', 'parsed', 'needs_review', 'draft', 'reviewed']) {
        expect(resolvePendingReview({ id: 'r', status }, true, counts)).toBe(1);
      }
      for (const status of ['approved', 'rejected', 'failed']) {
        expect(resolvePendingReview({ id: 'r', status }, true, counts)).toBe(0);
      }
    });
  });
});
