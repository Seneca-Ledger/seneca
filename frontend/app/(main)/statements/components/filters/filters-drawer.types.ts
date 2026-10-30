import type {
  StatementFilterDateMode,
  StatementFilterDatePreset,
  StatementFilters,
} from './statement-filters';

/** Labels, options and props of the documents list's Filters drawer. */
export type FiltersDrawerLabels = {
  title: string;
  viewResults: string;
  saveSearch: string;
  resetFilters: string;
  reset?: string;
  general: string;
  expenses: string;
  reports: string;
  type: string;
  from: string;
  groupBy: string;
  has: string;
  keywords: string;
  limit: string;
  status: string;
  to: string;
  amount: string;
  approved: string;
  billable: string;
  currency: string;
  date: string;
  exported: string;
  paid: string;
  any: string;
  yes: string;
  no: string;
};

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterDatePresetOption = {
  value: StatementFilterDatePreset;
  label: string;
};

export type FilterDateModeOption = {
  value: StatementFilterDateMode;
  label: string;
};

export type FilterAvatarOption = {
  id: string;
  label: string;
  description?: string | null;
  avatarUrl?: string | null;
  bankName?: string | null;
};

export type FiltersDrawerProps = {
  open: boolean;
  onClose: () => void;
  filters: StatementFilters;
  screen: string;
  visibleScreens?: string[];
  onBack: () => void;
  onSelect: (field: string) => void;
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  onResetAll: () => void;
  onViewResults: () => void;
  typeOptions: FilterOption[];
  statusOptions: FilterOption[];
  datePresets: FilterDatePresetOption[];
  dateModes: FilterDateModeOption[];
  fromOptions: FilterAvatarOption[];
  toOptions: FilterAvatarOption[];
  groupByOptions: FilterOption[];
  hasOptions: FilterOption[];
  currencyOptions: string[];
  labels: FiltersDrawerLabels;
  activeCount: number;
  routeFilterLabel?: string | null;
  onResetRouteFilter?: () => void;
};
