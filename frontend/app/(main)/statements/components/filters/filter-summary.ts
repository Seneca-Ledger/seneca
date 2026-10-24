import { getPresetRange, toDateOnly } from './statement-filter-internals';
import type { StatementFilterDate, StatementFilters } from './statement-filters';

/** The stretch of time a list shows, in the words its heading uses. */
export type FilterSpan =
  | { kind: 'allTime' }
  | { kind: 'between'; from: Date; to: Date }
  | { kind: 'on' | 'after' | 'before' | 'since' | 'until'; date: Date };

export type FilterSummaryTexts = {
  /** "All documents": nothing but the period narrows the list. */
  subjectAll: string;
  /** "Documents": other filters follow the period. */
  subjectSome: string;
  between: string;
  on: string;
  after: string;
  before: string;
  since: string;
  until: string;
  allTime: string;
};

/** The documents list's date filter as a span, read the way the list applies it. */
export function statementFilterSpan(date: StatementFilterDate | null, now: Date): FilterSpan {
  if (date?.preset) {
    const { start, end } = getPresetRange(date.preset, now);
    return { kind: 'between', from: start, to: end };
  }
  const first = toDateOnly(date?.date);
  if (!(date?.mode && first)) {
    return { kind: 'allTime' };
  }
  const second = toDateOnly(date.dateTo);
  if (date.mode === 'on') {
    if (!second) {
      return { kind: 'on', date: first };
    }
    const [from, to] = first <= second ? [first, second] : [second, first];
    return { kind: 'between', from, to };
  }
  if (date.mode === 'after') {
    return { kind: 'after', date: first };
  }
  return { kind: 'before', date: second ?? first };
}

/** The payables due-date range; both ends are inclusive. */
export function dueDateSpan(dueDateFrom: string, dueDateTo: string): FilterSpan {
  const from = toDateOnly(dueDateFrom);
  const to = toDateOnly(dueDateTo);
  if (from && to) {
    return { kind: 'between', from, to };
  }
  if (from) {
    return { kind: 'since', date: from };
  }
  if (to) {
    return { kind: 'until', date: to };
  }
  return { kind: 'allTime' };
}

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/**
 * One line that says what the list shows: the period first, then every other
 * filter in force, so nobody has to open the drawers to remember them.
 */
export function summarizeFilters(
  span: FilterSpan,
  extras: string[],
  texts: FilterSummaryTexts,
  formatDate: (date: Date) => string,
): string {
  const subject = extras.length > 0 ? texts.subjectSome : texts.subjectAll;
  const lead =
    span.kind === 'allTime'
      ? fill(texts.allTime, { subject })
      : span.kind === 'between'
        ? fill(texts.between, { subject, from: formatDate(span.from), to: formatDate(span.to) })
        : fill(texts[span.kind], { subject, date: formatDate(span.date) });
  return [lead, ...extras].join(' · ');
}

type Option = { value: string; label: string };

export type StatementExtrasContext = {
  search: string;
  routeFilterLabel: string | null;
  typeOptions: Option[];
  statusOptions: Option[];
  fromOptions: Array<{ id: string; label: string }>;
  toOptions: Array<{ id: string; label: string }>;
  groupByOptions: Option[];
  hasOptions: Option[];
  labels: {
    search: string;
    type: string;
    status: string;
    from: string;
    to: string;
    keywords: string;
    amount: string;
    limit: string;
    groupBy: string;
    has: string;
    currency: string;
    approved: string;
    billable: string;
    exported: string;
    paid: string;
    yes: string;
    no: string;
  };
  formatNumber: (value: number) => string;
};

const labelOf = (options: Option[], value: string): string =>
  options.find(option => option.value === value)?.label ?? value;

/** Every documents-list filter in force except the date, as "Label: value". */
export function statementFilterExtras(
  filters: StatementFilters,
  context: StatementExtrasContext,
): string[] {
  const { labels, formatNumber } = context;
  const list = (values: string[]): string | null => (values.length > 0 ? values.join(', ') : null);
  const quoted = (value: string): string | null => (value.trim() ? `“${value.trim()}”` : null);
  const yesNo = (value: boolean | null): string | null =>
    value === null ? null : value ? labels.yes : labels.no;
  const people = (ids: string[], options: Array<{ id: string; label: string }>): string | null =>
    list(ids.map(id => options.find(option => option.id === id)?.label ?? id));
  const optionList = (values: string[], options: Option[]): string | null =>
    list(values.map(value => labelOf(options, value)));

  const { amountMin, amountMax } = filters;
  const min = amountMin === null ? null : formatNumber(amountMin);
  const max = amountMax === null ? null : formatNumber(amountMax);
  const amount = min && max ? `${min}–${max}` : min ? `≥ ${min}` : max ? `≤ ${max}` : null;

  // In the order the drawers offer them; a null value is a filter not in force.
  const rows: Array<[string, string | null]> = [
    [labels.search, quoted(context.search)],
    [labels.type, filters.type ? labelOf(context.typeOptions, filters.type) : null],
    [labels.status, optionList(filters.statuses, context.statusOptions)],
    [labels.from, people(filters.from, context.fromOptions)],
    [labels.to, people(filters.to, context.toOptions)],
    [labels.keywords, quoted(filters.keywords)],
    [labels.amount, amount],
    [labels.currency, list(filters.currencies)],
    [labels.has, optionList(filters.has, context.hasOptions)],
    [labels.approved, yesNo(filters.approved)],
    [labels.billable, yesNo(filters.billable)],
    [labels.exported, yesNo(filters.exported)],
    [labels.paid, yesNo(filters.paid)],
    [labels.groupBy, filters.groupBy ? labelOf(context.groupByOptions, filters.groupBy) : null],
    [labels.limit, filters.limit ? formatNumber(filters.limit) : null],
  ];
  const extras = rows.flatMap(([label, value]) => (value === null ? [] : [`${label}: ${value}`]));
  return context.routeFilterLabel ? [context.routeFilterLabel, ...extras] : extras;
}

/** Every payables filter in force except the due dates, as "Label: value". */
export function payableFilterExtras(
  filters: { search: string; status: string; source: string; tagId?: string },
  context: {
    labels: { search: string; status: string; source: string; tag?: string };
    statusOptions: Record<string, string>;
    sourceOptions: Record<string, string>;
    /** Tag names by id. */
    tagOptions?: Record<string, string>;
  },
): string[] {
  const { labels } = context;
  const extras: string[] = [];
  if (filters.search.trim()) {
    extras.push(`${labels.search}: “${filters.search.trim()}”`);
  }
  if (filters.status !== 'all') {
    extras.push(`${labels.status}: ${context.statusOptions[filters.status] ?? filters.status}`);
  }
  if (filters.source !== 'all') {
    extras.push(`${labels.source}: ${context.sourceOptions[filters.source] ?? filters.source}`);
  }
  // Named once the tags have loaded; an id means nothing to read.
  const tagName = filters.tagId ? context.tagOptions?.[filters.tagId] : undefined;
  if (tagName) {
    extras.push(`${labels.tag}: ${tagName}`);
  }
  return extras;
}
