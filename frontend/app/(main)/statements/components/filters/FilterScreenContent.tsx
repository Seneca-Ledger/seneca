'use client';

import { AmountViewFilterScreen, ChoiceFilterScreen } from './ChoiceFilterScreen';
import {
  BooleanFilterScreen,
  CurrencyFilterScreen,
  FromToFilterScreen,
  HasFilterScreen,
  isBooleanFilterScreen,
  StatusFilterScreen,
  TypeFilterScreen,
} from './FilterChoiceScreens';
import {
  AmountFilterScreen,
  DateFilterScreen,
  KeywordsFilterScreen,
  LimitFilterScreen,
} from './FilterInputScreens';
import type {
  FilterAvatarOption,
  FilterDateModeOption,
  FilterDatePresetOption,
  FilterOption,
  FiltersDrawerLabels,
} from './filters-drawer.types';
import type { StatementFilters } from './statement-filters';

/** The drawer's inner screen for the filter picked on its first screen, and its title. */
export type ScreenContentProps = {
  screen: string;
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  typeOptions: FilterOption[];
  statusOptions: FilterOption[];
  datePresets: FilterDatePresetOption[];
  dateModes: FilterDateModeOption[];
  fromOptions: FilterAvatarOption[];
  toOptions: FilterAvatarOption[];
  groupByOptions: FilterOption[];
  amountViewOptions: FilterOption[];
  hasOptions: FilterOption[];
  currencyOptions: string[];
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  toggleValue: (values: string[], value: string) => string[];
  inputStyle: React.CSSProperties;
};

export function ScreenContent(props: ScreenContentProps) {
  const { screen, filters, labels, onUpdateFilters, toggleValue, inputStyle } = props;
  if (screen === 'type') {
    return (
      <TypeFilterScreen
        filters={filters}
        labels={labels}
        typeOptions={props.typeOptions}
        onUpdateFilters={onUpdateFilters}
      />
    );
  }
  if (screen === 'status') {
    return (
      <StatusFilterScreen
        filters={filters}
        labels={labels}
        statusOptions={props.statusOptions}
        onUpdateFilters={onUpdateFilters}
        toggleValue={toggleValue}
      />
    );
  }
  if (screen === 'date') {
    return (
      <DateFilterScreen
        filters={filters}
        labels={labels}
        datePresets={props.datePresets}
        dateModes={props.dateModes}
        onUpdateFilters={onUpdateFilters}
      />
    );
  }
  if (screen === 'from' || screen === 'to') {
    return (
      <FromToFilterScreen
        screen={screen}
        filters={filters}
        labels={labels}
        fromOptions={props.fromOptions}
        toOptions={props.toOptions}
        onUpdateFilters={onUpdateFilters}
        toggleValue={toggleValue}
      />
    );
  }
  if (screen === 'keywords') {
    return (
      <KeywordsFilterScreen
        filters={filters}
        labels={labels}
        onUpdateFilters={onUpdateFilters}
        inputStyle={inputStyle}
      />
    );
  }
  if (screen === 'amount') {
    return (
      <AmountFilterScreen
        filters={filters}
        labels={labels}
        onUpdateFilters={onUpdateFilters}
        inputStyle={inputStyle}
      />
    );
  }
  if (isBooleanFilterScreen(screen)) {
    return (
      <BooleanFilterScreen
        screen={screen}
        filters={filters}
        labels={labels}
        onUpdateFilters={onUpdateFilters}
      />
    );
  }
  if (screen === 'groupBy') {
    return (
      <ChoiceFilterScreen
        value={filters.groupBy}
        options={props.groupByOptions}
        anyLabel={labels.any}
        onSelect={groupBy => onUpdateFilters({ groupBy })}
      />
    );
  }
  if (screen === 'amountView') {
    const { amountViewOptions: options } = props;
    return (
      <AmountViewFilterScreen
        filters={filters}
        options={options}
        onUpdateFilters={onUpdateFilters}
      />
    );
  }
  if (screen === 'has') {
    return (
      <HasFilterScreen
        filters={filters}
        labels={labels}
        hasOptions={props.hasOptions}
        onUpdateFilters={onUpdateFilters}
        toggleValue={toggleValue}
      />
    );
  }
  if (screen === 'limit') {
    return (
      <LimitFilterScreen
        filters={filters}
        labels={labels}
        onUpdateFilters={onUpdateFilters}
        inputStyle={inputStyle}
      />
    );
  }
  if (screen === 'currency') {
    return (
      <CurrencyFilterScreen
        filters={filters}
        labels={labels}
        currencyOptions={props.currencyOptions}
        onUpdateFilters={onUpdateFilters}
        toggleValue={toggleValue}
      />
    );
  }
  return null;
}

export const SCREEN_TITLE_MAP: Record<string, keyof FiltersDrawerLabels> = {
  type: 'type',
  status: 'status',
  date: 'date',
  from: 'from',
  to: 'to',
  keywords: 'keywords',
  amount: 'amount',
  approved: 'approved',
  billable: 'billable',
  groupBy: 'groupBy',
  has: 'has',
  limit: 'limit',
  currency: 'currency',
  exported: 'exported',
  paid: 'paid',
};

export function getScreenTitle(screen: string, labels: FiltersDrawerLabels): string {
  const key = SCREEN_TITLE_MAP[screen];
  return (key ? labels[key] : undefined) ?? labels.title;
}
