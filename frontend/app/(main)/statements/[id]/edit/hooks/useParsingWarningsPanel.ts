import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_RECENT_CURRENCIES } from '@/app/lib/currency';
import type { CurrencySearchItem } from '@/app/lib/statement-expense-drawer';
import { buildCurrencySearchIndex } from '@/app/lib/statement-expense-drawer';
import {
  canConvertDraft,
  type DroppedSampleDraft,
  normalizeCurrencyCode,
  toDraft,
} from '../helpers/warning-formatters';
import { buildWarningHandlers } from '../helpers/warning-handlers';
import type {
  ConvertDroppedSamplePayload,
  ParsingDroppedSample,
  ResolveWarningPayload,
} from '../ParsingWarningsPanel';

export interface EditableWarningEntry {
  key: string;
  sample: ParsingDroppedSample;
  reason: string;
  txKey: string | null;
  action: 'convert' | 'resolve';
}

export interface SelectedWarning {
  entryKey: string;
  warning: string;
  warningIndex: number;
}

const isCurrencySearchItem = (item: CurrencySearchItem | undefined): item is CurrencySearchItem =>
  item !== undefined;

interface EntryMaps {
  byKey: Map<string, EditableWarningEntry>;
  byReason: Map<string, EditableWarningEntry>;
  byTxKey: Map<string, EditableWarningEntry>;
}

const buildEntryMaps = (editableEntries: EditableWarningEntry[]): EntryMaps => ({
  byKey: new Map(editableEntries.map(entry => [entry.key, entry] as const)),
  byReason: new Map(editableEntries.map(entry => [entry.reason, entry] as const)),
  byTxKey: new Map(
    editableEntries
      .filter((entry): entry is EditableWarningEntry & { txKey: string } => Boolean(entry.txKey))
      .map(entry => [entry.txKey, entry] as const),
  ),
});

export interface UseParsingWarningsPanelParams {
  warnings: string[];
  editableEntries: EditableWarningEntry[];
  onConvertDroppedSample?: (payload: ConvertDroppedSamplePayload) => void | Promise<void>;
  onResolveWarning?: (payload: ResolveWarningPayload) => void;
}

export interface UseParsingWarningsPanelReturn {
  draftsByKey: Record<string, DroppedSampleDraft>;
  setDraftsByKey: React.Dispatch<React.SetStateAction<Record<string, DroppedSampleDraft>>>;
  convertingKey: string | null;
  currencyPickerOpen: boolean;
  setCurrencyPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currencySearch: string;
  setCurrencySearch: React.Dispatch<React.SetStateAction<string>>;
  recentCurrencies: string[];
  setRecentCurrencies: React.Dispatch<React.SetStateAction<string[]>>;
  selectedWarning: SelectedWarning | null;
  setSelectedWarning: React.Dispatch<React.SetStateAction<SelectedWarning | null>>;
  editableEntryByKey: Map<string, EditableWarningEntry>;
  editableEntryByReason: Map<string, EditableWarningEntry>;
  editableEntryByTxKey: Map<string, EditableWarningEntry>;
  selectedEntry: EditableWarningEntry | null;
  selectedDraft: DroppedSampleDraft | null;
  selectedCanConvert: boolean;
  selectedIsConverting: boolean;
  currencyItems: CurrencySearchItem[];
  currencyByCode: Map<string, CurrencySearchItem>;
  selectedCurrencyCode: string;
  selectedCurrencyItem: CurrencySearchItem | null;
  currencyQuery: string;
  selectedMatchesSearch: boolean;
  recentCurrencyItems: CurrencySearchItem[];
  allCurrencyItems: CurrencySearchItem[];
  isDialogOpen: boolean;
  handleConvert: () => Promise<void>;
  handleResolve: (args: { warning: string; warningIndex: number }) => void;
  handleCloseCurrencyPicker: () => void;
  handleSelectCurrency: (code: string) => void;
  handleSelectWarning: (args: { entryKey: string; warning: string; warningIndex: number }) => void;
  updateDraft: (args: { field: keyof DroppedSampleDraft; value: string }) => void;
}

function useEntryState(editableEntries: EditableWarningEntry[]): {
  draftsByKey: Record<string, DroppedSampleDraft>;
  setDraftsByKey: React.Dispatch<React.SetStateAction<Record<string, DroppedSampleDraft>>>;
  entryMaps: EntryMaps;
} {
  const [draftsByKey, setDraftsByKey] = useState<Record<string, DroppedSampleDraft>>({});
  const entryMaps = useMemo(() => buildEntryMaps(editableEntries), [editableEntries]);
  useEffect(() => {
    setDraftsByKey(current => {
      const next: Record<string, DroppedSampleDraft> = {};
      editableEntries.forEach(entry => {
        next[entry.key] = current[entry.key] ?? toDraft(entry.sample);
      });
      return next;
    });
  }, [editableEntries]);
  return { draftsByKey, setDraftsByKey, entryMaps };
}

interface CurrencyStateParams {
  currencySearch: string;
  selectedDraft: DroppedSampleDraft | null;
  recentCurrencies: string[];
}

interface CurrencyStateReturn {
  currencyItems: CurrencySearchItem[];
  currencyByCode: Map<string, CurrencySearchItem>;
  selectedCurrencyCode: string;
  selectedCurrencyItem: CurrencySearchItem | null;
  currencyQuery: string;
  selectedMatchesSearch: boolean;
  recentCurrencyItems: CurrencySearchItem[];
  allCurrencyItems: CurrencySearchItem[];
}

const computeSelectedMatchesSearch = (
  selectedCurrencyItem: CurrencySearchItem | null,
  currencyQuery: string,
): boolean => {
  if (!selectedCurrencyItem) {
    return false;
  }
  if (!currencyQuery) {
    return true;
  }
  return selectedCurrencyItem.searchText.includes(currencyQuery);
};

function useCurrencyState({
  currencySearch,
  selectedDraft,
  recentCurrencies,
}: CurrencyStateParams): CurrencyStateReturn {
  const currencyItems = useMemo(() => buildCurrencySearchIndex(), []);
  const currencyByCode = useMemo(
    () => new Map(currencyItems.map(item => [item.code, item] as const)),
    [currencyItems],
  );
  const selectedCurrencyCode = normalizeCurrencyCode(selectedDraft?.currency ?? '');
  const selectedCurrencyItem = selectedCurrencyCode
    ? (currencyByCode.get(selectedCurrencyCode) ?? null)
    : null;
  const currencyQuery = currencySearch.trim().toLowerCase();
  const selectedMatchesSearch = computeSelectedMatchesSearch(selectedCurrencyItem, currencyQuery);
  const recentCurrencyItems = useMemo(
    () =>
      recentCurrencies
        .map(code => currencyByCode.get(code))
        .filter(isCurrencySearchItem)
        .filter(item => item.code !== selectedCurrencyCode),
    [currencyByCode, recentCurrencies, selectedCurrencyCode],
  );
  const allCurrencyItems = useMemo(() => {
    const source =
      currencyQuery.length > 0
        ? currencyItems.filter(item => item.searchText.includes(currencyQuery))
        : currencyItems;
    return source.filter(item => item.code !== selectedCurrencyCode);
  }, [currencyItems, currencyQuery, selectedCurrencyCode]);
  return {
    currencyItems,
    currencyByCode,
    selectedCurrencyCode,
    selectedCurrencyItem,
    currencyQuery,
    selectedMatchesSearch,
    recentCurrencyItems,
    allCurrencyItems,
  };
}

interface SelectionDerivedState {
  selectedEntry: EditableWarningEntry | null;
  selectedDraft: DroppedSampleDraft | null;
  selectedCanConvert: boolean;
  selectedIsConverting: boolean;
  isDialogOpen: boolean;
}

const resolveSelectedEntry = (
  selectedWarning: SelectedWarning | null,
  byKey: Map<string, EditableWarningEntry>,
): EditableWarningEntry | null => {
  if (!selectedWarning) {
    return null;
  }
  return byKey.get(selectedWarning.entryKey) ?? null;
};

const resolveSelectedDraft = (
  selectedEntry: EditableWarningEntry | null,
  draftsByKey: Record<string, DroppedSampleDraft>,
): DroppedSampleDraft | null => {
  if (!selectedEntry) {
    return null;
  }
  return draftsByKey[selectedEntry.key] ?? toDraft(selectedEntry.sample);
};

const deriveSelectionState = ({
  selectedWarning,
  editableEntryByKey,
  draftsByKey,
  convertingKey,
}: {
  selectedWarning: SelectedWarning | null;
  editableEntryByKey: Map<string, EditableWarningEntry>;
  draftsByKey: Record<string, DroppedSampleDraft>;
  convertingKey: string | null;
}): SelectionDerivedState => {
  const selectedEntry = resolveSelectedEntry(selectedWarning, editableEntryByKey);
  const selectedDraft = resolveSelectedDraft(selectedEntry, draftsByKey);
  const selectedCanConvert = selectedDraft ? canConvertDraft(selectedDraft) : false;
  const selectedIsConverting = selectedEntry !== null && convertingKey === selectedEntry.key;
  const isDialogOpen = selectedWarning !== null && selectedEntry !== null && selectedDraft !== null;
  return { selectedEntry, selectedDraft, selectedCanConvert, selectedIsConverting, isDialogOpen };
};

function useWarningSelection({
  warnings,
  editableEntryByKey,
}: {
  warnings: string[];
  editableEntryByKey: Map<string, EditableWarningEntry>;
}): {
  selectedWarning: SelectedWarning | null;
  setSelectedWarning: React.Dispatch<React.SetStateAction<SelectedWarning | null>>;
  currencyPickerOpen: boolean;
  setCurrencyPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currencySearch: string;
  setCurrencySearch: React.Dispatch<React.SetStateAction<string>>;
} {
  const [selectedWarning, setSelectedWarning] = useState<SelectedWarning | null>(null);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  useEffect(() => {
    if (!selectedWarning) {
      return;
    }
    const entry = editableEntryByKey.get(selectedWarning.entryKey);
    if (!(entry && warnings.includes(selectedWarning.warning))) {
      setSelectedWarning(null);
    }
  }, [editableEntryByKey, selectedWarning, warnings]);

  useEffect(() => {
    if (!selectedWarning) {
      setCurrencyPickerOpen(false);
      setCurrencySearch('');
    }
  }, [selectedWarning]);

  return {
    selectedWarning,
    setSelectedWarning,
    currencyPickerOpen,
    setCurrencyPickerOpen,
    currencySearch,
    setCurrencySearch,
  };
}

export function useParsingWarningsPanel({
  warnings,
  editableEntries,
  onConvertDroppedSample,
  onResolveWarning,
}: UseParsingWarningsPanelParams): UseParsingWarningsPanelReturn {
  const [convertingKey, setConvertingKey] = useState<string | null>(null);
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>([
    ...DEFAULT_RECENT_CURRENCIES,
  ]);

  const { draftsByKey, setDraftsByKey, entryMaps } = useEntryState(editableEntries);
  const {
    byKey: editableEntryByKey,
    byReason: editableEntryByReason,
    byTxKey: editableEntryByTxKey,
  } = entryMaps;

  const {
    selectedWarning,
    setSelectedWarning,
    currencyPickerOpen,
    setCurrencyPickerOpen,
    currencySearch,
    setCurrencySearch,
  } = useWarningSelection({ warnings, editableEntryByKey });

  const { selectedEntry, selectedDraft, selectedCanConvert, selectedIsConverting, isDialogOpen } =
    deriveSelectionState({ selectedWarning, editableEntryByKey, draftsByKey, convertingKey });

  const currencyState = useCurrencyState({ currencySearch, selectedDraft, recentCurrencies });

  const handlers = buildWarningHandlers({
    selectedWarning,
    editableEntryByKey,
    draftsByKey,
    setDraftsByKey,
    setConvertingKey,
    setSelectedWarning,
    setRecentCurrencies,
    setCurrencyPickerOpen,
    setCurrencySearch,
    onConvertDroppedSample,
    onResolveWarning,
  });

  return {
    draftsByKey,
    setDraftsByKey,
    convertingKey,
    currencyPickerOpen,
    setCurrencyPickerOpen,
    currencySearch,
    setCurrencySearch,
    recentCurrencies,
    setRecentCurrencies,
    selectedWarning,
    setSelectedWarning,
    editableEntryByKey,
    editableEntryByReason,
    editableEntryByTxKey,
    selectedEntry,
    selectedDraft,
    selectedCanConvert,
    selectedIsConverting,
    ...currencyState,
    isDialogOpen,
    ...handlers,
  };
}
