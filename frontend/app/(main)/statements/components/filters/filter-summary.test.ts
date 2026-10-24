import { describe, expect, it } from 'vitest';
import {
  dueDateSpan,
  type FilterSummaryTexts,
  payableFilterExtras,
  type StatementExtrasContext,
  statementFilterExtras,
  statementFilterSpan,
  summarizeFilters,
} from './filter-summary';
import { DEFAULT_STATEMENT_FILTERS } from './statement-filters';

const TEXTS: FilterSummaryTexts = {
  subjectAll: 'All expenses',
  subjectSome: 'Expenses',
  between: '{subject} between {from} and {to}',
  on: '{subject} on {date}',
  after: '{subject} after {date}',
  before: '{subject} before {date}',
  since: '{subject} from {date}',
  until: '{subject} until {date}',
  allTime: '{subject} for all time',
};

const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const NOW = new Date(2026, 9, 23);

const CONTEXT: StatementExtrasContext = {
  search: '',
  routeFilterLabel: null,
  typeOptions: [{ value: 'receipt', label: 'Receipt' }],
  statusOptions: [
    { value: 'parsed', label: 'Parsed' },
    { value: 'error', label: 'Error' },
  ],
  fromOptions: [{ id: 'member-1', label: 'Member One' }],
  toOptions: [],
  groupByOptions: [{ value: 'status', label: 'Status' }],
  hasOptions: [],
  labels: {
    search: 'Search',
    type: 'Type',
    status: 'Status',
    from: 'From',
    to: 'To',
    keywords: 'Keywords',
    amount: 'Amount',
    limit: 'Limit',
    groupBy: 'Group by',
    has: 'Has',
    currency: 'Currency',
    approved: 'Approved',
    billable: 'Billable',
    exported: 'Exported',
    paid: 'Paid',
    yes: 'Yes',
    no: 'No',
  },
  formatNumber: value => String(value),
};

describe('statementFilterSpan', () => {
  it('reads "this month" as its first and last day', () => {
    const span = statementFilterSpan({ preset: 'thisMonth' }, NOW);
    expect(span.kind).toBe('between');
    if (span.kind !== 'between') return;
    expect([isoDay(span.from), isoDay(span.to)]).toEqual(['2026-10-01', '2026-10-31']);
  });

  it('orders an "on" range picked backwards', () => {
    const span = statementFilterSpan({ mode: 'on', date: '2026-10-20', dateTo: '2026-10-05' }, NOW);
    expect(span.kind === 'between' && [isoDay(span.from), isoDay(span.to)]).toEqual([
      '2026-10-05',
      '2026-10-20',
    ]);
  });

  it('is all time without a date filter or with a mode but no date', () => {
    expect(statementFilterSpan(null, NOW)).toEqual({ kind: 'allTime' });
    expect(statementFilterSpan({ mode: 'after' }, NOW)).toEqual({ kind: 'allTime' });
  });

  it('reads "before" from the end of a range, as the list does', () => {
    const span = statementFilterSpan({ mode: 'before', date: '2026-10-01', dateTo: '2026-10-15' }, NOW);
    expect(span.kind === 'before' && isoDay(span.date)).toBe('2026-10-15');
  });
});

describe('dueDateSpan', () => {
  it('uses inclusive words for an open-ended range', () => {
    expect(dueDateSpan('2026-10-01', '').kind).toBe('since');
    expect(dueDateSpan('', '2026-10-31').kind).toBe('until');
    expect(dueDateSpan('', '')).toEqual({ kind: 'allTime' });
  });
});

describe('summarizeFilters', () => {
  const format = (date: Date): string => isoDay(date);

  it('says "all" when only the period narrows the list', () => {
    const span = statementFilterSpan({ preset: 'thisMonth' }, NOW);
    expect(summarizeFilters(span, [], TEXTS, format)).toBe(
      'All expenses between 2026-10-01 and 2026-10-31',
    );
  });

  it('drops "all" and lists the other filters after the period', () => {
    expect(summarizeFilters({ kind: 'allTime' }, ['Status: Paid'], TEXTS, format)).toBe(
      'Expenses for all time · Status: Paid',
    );
  });
});

describe('statementFilterExtras', () => {
  it('has nothing to say about the default filters', () => {
    expect(statementFilterExtras(DEFAULT_STATEMENT_FILTERS, CONTEXT)).toEqual([]);
  });

  it('names every filter in force by its option labels, the date aside', () => {
    const extras = statementFilterExtras(
      {
        ...DEFAULT_STATEMENT_FILTERS,
        type: 'receipt',
        statuses: ['parsed', 'error'],
        from: ['member-1'],
        date: { preset: 'lastMonth' },
        amountMin: 10,
        paid: false,
      },
      { ...CONTEXT, search: ' wireless ', routeFilterLabel: 'Category: Groceries' },
    );
    expect(extras).toEqual([
      'Category: Groceries',
      'Search: “wireless”',
      'Type: Receipt',
      'Status: Parsed, Error',
      'From: Member One',
      'Amount: ≥ 10',
      'Paid: No',
    ]);
  });

  it('shows an amount range and an upper bound', () => {
    const range = { ...DEFAULT_STATEMENT_FILTERS, amountMin: 5, amountMax: 50 };
    const upper = { ...DEFAULT_STATEMENT_FILTERS, amountMax: 50 };
    expect(statementFilterExtras(range, CONTEXT)).toEqual(['Amount: 5–50']);
    expect(statementFilterExtras(upper, CONTEXT)).toEqual(['Amount: ≤ 50']);
  });
});

describe('payableFilterExtras', () => {
  const context = {
    labels: { search: 'Search', status: 'Status', source: 'Source' },
    statusOptions: { overdue: 'Overdue' },
    sourceOptions: { invoice: 'Invoice' },
  };

  it('skips "all" and names the chosen status and source', () => {
    expect(payableFilterExtras({ search: '', status: 'all', source: 'all' }, context)).toEqual([]);
    expect(
      payableFilterExtras({ search: 'acme', status: 'overdue', source: 'invoice' }, context),
    ).toEqual(['Search: “acme”', 'Status: Overdue', 'Source: Invoice']);
  });

  it('names the chosen tag', () => {
    const travel = { id: 'tag-1', name: 'Travel' };
    const withTags = {
      ...context,
      labels: { ...context.labels, tag: 'Tags' },
      tagOptions: { [travel.id]: travel.name },
    };
    expect(
      payableFilterExtras({ search: '', status: 'all', source: 'all', tagId: travel.id }, withTags),
    ).toEqual([`Tags: ${travel.name}`]);
  });
});
