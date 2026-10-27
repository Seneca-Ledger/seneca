import type { TableLabels } from './StatementsListTable';

/** The documents table's labels, from the page's header, empty-state and pagination texts. */
export function buildTableLabels(
  header: Record<string, string>,
  empty: { title: { value: string }; description: { value: string } },
  pagination: Record<string, string>,
): TableLabels {
  return {
    merchant: header.merchant,
    date: header.date,
    amount: header.amount,
    action: header.action,
    receipt: header.receipt,
    scanning: header.scanning,
    emptyTitle: empty.title.value,
    emptyDescription: empty.description.value,
    paginationShown: pagination.shown,
    paginationPageOf: pagination.pageOf,
  };
}
