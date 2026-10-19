import type React from 'react';
import type { EditableWarningEntry, SelectedWarning } from '../hooks/useParsingWarningsPanel';
import type {
  ConvertDroppedSamplePayload,
  ParsingDroppedSample,
  ResolveWarningPayload,
} from '../ParsingWarningsPanel';
import type { DroppedSampleDraft } from './warning-formatters';
import {
  canConvertDraft,
  normalizeCurrencyCode,
  parsePositiveNumber,
  toDraft,
} from './warning-formatters';

type BuildNextArgs = { entry: EditableWarningEntry; draft: DroppedSampleDraft };

function buildNextSampleTransaction({
  entry,
  draft,
}: BuildNextArgs): ParsingDroppedSample['transaction'] {
  const debit = parsePositiveNumber(draft.debit);
  const credit = parsePositiveNumber(draft.credit);
  return {
    ...entry.sample.transaction,
    transactionDate: draft.transactionDate,
    counterpartyName: draft.counterpartyName.trim(),
    paymentPurpose: draft.paymentPurpose.trim(),
    debit: debit ?? undefined,
    credit: credit ?? undefined,
    currency: normalizeCurrencyCode(draft.currency) || undefined,
  };
}

export type HandlerParams = {
  selectedWarning: SelectedWarning | null;
  editableEntryByKey: Map<string, EditableWarningEntry>;
  draftsByKey: Record<string, DroppedSampleDraft>;
  setDraftsByKey: React.Dispatch<React.SetStateAction<Record<string, DroppedSampleDraft>>>;
  setConvertingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedWarning: React.Dispatch<React.SetStateAction<SelectedWarning | null>>;
  setRecentCurrencies: React.Dispatch<React.SetStateAction<string[]>>;
  setCurrencyPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrencySearch: React.Dispatch<React.SetStateAction<string>>;
  onConvertDroppedSample?: (payload: ConvertDroppedSamplePayload) => void | Promise<void>;
  onResolveWarning?: (payload: ResolveWarningPayload) => void;
};

export type WarningHandlers = {
  updateDraft: (args: { field: keyof DroppedSampleDraft; value: string }) => void;
  handleConvert: () => Promise<void>;
  handleResolve: (args: { warning: string; warningIndex: number }) => void;
  handleCloseCurrencyPicker: () => void;
  handleSelectCurrency: (code: string) => void;
  handleSelectWarning: (args: { entryKey: string; warning: string; warningIndex: number }) => void;
};

export function buildWarningHandlers(p: HandlerParams): WarningHandlers {
  const handleCloseCurrencyPicker = (): void => {
    p.setCurrencyPickerOpen(false);
    p.setCurrencySearch('');
  };
  const updateDraft = ({
    field,
    value,
  }: {
    field: keyof DroppedSampleDraft;
    value: string;
  }): void => {
    if (!p.selectedWarning) {
      return;
    }
    const key = p.editableEntryByKey.get(p.selectedWarning.entryKey)?.key;
    if (!key) {
      return;
    }
    p.setDraftsByKey(current => ({
      ...current,
      [key]: { ...(current[key] ?? toDraft('')), [field]: value },
    }));
  };
  const handleConvert = async (): Promise<void> => {
    if (!(p.onConvertDroppedSample && p.selectedWarning)) {
      return;
    }
    const activeEntry = p.editableEntryByKey.get(p.selectedWarning.entryKey);
    if (!activeEntry) {
      return;
    }
    const draft = p.draftsByKey[activeEntry.key] ?? toDraft(activeEntry.sample);
    if (!canConvertDraft(draft)) {
      return;
    }
    const nextSample: ParsingDroppedSample = {
      ...activeEntry.sample,
      transaction: buildNextSampleTransaction({ entry: activeEntry, draft }),
    };
    p.setConvertingKey(activeEntry.key);
    try {
      await Promise.resolve(
        p.onConvertDroppedSample({
          sample: nextSample,
          index: p.selectedWarning.warningIndex,
          warning: p.selectedWarning.warning,
        }),
      );
      p.setSelectedWarning(current => (current?.entryKey === activeEntry.key ? null : current));
    } finally {
      p.setConvertingKey(current => (current === activeEntry.key ? null : current));
    }
  };
  const handleResolve = ({
    warning,
    warningIndex,
  }: {
    warning: string;
    warningIndex: number;
  }): void => {
    p.onResolveWarning?.({ warning, index: warningIndex });
  };
  const handleSelectCurrency = (currencyCode: string): void => {
    const activeEntry = p.selectedWarning
      ? p.editableEntryByKey.get(p.selectedWarning.entryKey)
      : null;
    if (!activeEntry) {
      return;
    }
    p.setDraftsByKey(current => ({
      ...current,
      [activeEntry.key]: {
        ...(current[activeEntry.key] ?? toDraft(activeEntry.sample)),
        currency: currencyCode,
      },
    }));
    p.setRecentCurrencies(current => [
      currencyCode,
      ...current.filter(item => item !== currencyCode),
    ]);
    handleCloseCurrencyPicker();
  };
  const handleSelectWarning = ({
    entryKey,
    warning,
    warningIndex,
  }: {
    entryKey: string;
    warning: string;
    warningIndex: number;
  }): void => {
    p.setSelectedWarning({ entryKey, warning, warningIndex });
  };
  return {
    updateDraft,
    handleConvert,
    handleResolve,
    handleCloseCurrencyPicker,
    handleSelectCurrency,
    handleSelectWarning,
  };
}
