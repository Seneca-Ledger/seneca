import type { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import {
  buildDateModes,
  buildDatePresets,
  buildFilterLabels,
  buildFilterOptionLabels,
  buildGroupByOptions,
  buildHasOptions,
  buildListHeaderLabels,
  buildPaginationLabels,
  buildStatusOptions,
  buildTypeOptions,
  buildUploadLabels,
} from '../StatementsListView.utils';

/** The documents page's labels and the Filters drawer's options, in the reader's language. */
export function statementsViewLabels(t: ReturnType<typeof useIntlayer<'statementsPage'>>) {
  const tx = (path: string[]): string => resolveLabel(getNestedValue(t, path));

  const filterLabels = buildFilterLabels(t);
  const filterOptionLabels = buildFilterOptionLabels(t, tx);
  const listHeaderLabels = buildListHeaderLabels(t);
  const paginationLabels = buildPaginationLabels(tx);
  const uploadLabels = buildUploadLabels(t);

  const typeOptions = buildTypeOptions(filterOptionLabels);
  const statusOptions = buildStatusOptions(filterOptionLabels);
  const datePresets = buildDatePresets(filterOptionLabels);
  const dateModes = buildDateModes(filterOptionLabels);
  const groupByOptions = buildGroupByOptions(filterOptionLabels);
  const hasOptions = buildHasOptions(filterOptionLabels);

  return {
    filterLabels,
    filterOptionLabels,
    listHeaderLabels,
    paginationLabels,
    uploadLabels,
    typeOptions,
    statusOptions,
    datePresets,
    dateModes,
    groupByOptions,
    hasOptions,
  };
}
