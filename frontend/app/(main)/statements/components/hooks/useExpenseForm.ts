/* eslint-disable max-lines */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { type DeviceLocation, getDeviceLocation } from '@/app/lib/device-location';
import { getReceiptLocationCapture } from '@/app/lib/receipt-location-capture';
import {
  flattenStatementCategories,
  type StatementCategoryNode,
} from '@/app/lib/statement-categories';
import {
  ALWAYS_ALLOW_STATEMENT_DUPLICATES,
  buildCurrencySearchIndex,
  type CurrencySearchItem,
  computeManualAmountFontSize,
  createDefaultManualDraft,
  DEFAULT_RECENT_CURRENCIES,
  hasPositiveManualAmount,
  type ManualExpenseDraft,
  type ManualStep,
  resolveDefaultCurrency,
  resolveExpenseDrawerMode,
  type StatementExpenseMode,
  type TaxRateOption,
  validateManualExpenseDraft,
} from '@/app/lib/statement-expense-drawer';

type SubmitScanPayload = {
  files: File[];
  allowDuplicates: boolean;
  requireManualCategorySelection: boolean;
  deviceLocationRequest: Promise<DeviceLocation | null> | null;
};

export type SelectedFilesOrigin = 'camera' | 'gallery';

type SubmitManualPayload = {
  draft: ManualExpenseDraft;
  date: string;
  files: File[];
  allowDuplicates: boolean;
};

type UseExpenseFormProps = {
  open: boolean;
  initialMode: StatementExpenseMode;
  defaultCurrency?: string | null;
  categories: StatementCategoryNode[];
  taxRates: TaxRateOption[];
  onClose: () => void;
  onSubmitScan: (payload: SubmitScanPayload) => Promise<void>;
  onSubmitManual: (payload: SubmitManualPayload) => Promise<void>;
};

export type UseExpenseFormReturn = {
  mode: StatementExpenseMode;
  setMode: (mode: StatementExpenseMode) => void;
  manualStep: ManualStep;
  setManualStep: (step: ManualStep) => void;
  currencyPickerOpen: boolean;
  setCurrencyPickerOpen: (open: boolean) => void;
  categoryDrawerOpen: boolean;
  setCategoryDrawerOpen: (open: boolean) => void;
  taxRateDrawerOpen: boolean;
  setTaxRateDrawerOpen: (open: boolean) => void;
  currencySearch: string;
  setCurrencySearch: (query: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  manualDraft: ManualExpenseDraft;
  setManualDraft: (
    updater: ManualExpenseDraft | ((prev: ManualExpenseDraft) => ManualExpenseDraft),
  ) => void;
  manualDate: string;
  setManualDate: (date: string) => void;
  submitting: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  manualAmountInputRef: React.RefObject<HTMLInputElement | null>;
  // Derived
  selectedCurrencyItem: CurrencySearchItem | undefined;
  selectedCurrencySymbol: string;
  manualAmountFontSize: number;
  flatCategories: ReturnType<typeof flattenStatementCategories>;
  selectedCategoryName: string;
  defaultTaxRate: TaxRateOption | null;
  selectedTaxRate: TaxRateOption | null;
  enabledTaxRates: TaxRateOption[];
  selectedMatchesSearch: boolean;
  recentCurrencyItems: CurrencySearchItem[];
  allCurrencyItems: CurrencySearchItem[];
  hasManualAmount: boolean;
  manualValidation: ReturnType<typeof validateManualExpenseDraft>;
  // Handlers
  handleSelectCurrency: (currencyCode: string) => void;
  handleClose: () => void;
  handleBackClick: () => void;
  handleFilesSelected: (selected: FileList | File[] | null, origin?: SelectedFilesOrigin) => void;
  handleManualNext: () => void;
  handleSubmitScan: () => Promise<void>;
  handleSubmitManual: () => Promise<void>;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function
export function useExpenseForm({
  open,
  initialMode,
  defaultCurrency,
  categories,
  taxRates,
  onClose,
  onSubmitScan,
  onSubmitManual,
}: UseExpenseFormProps) {
  const { locale } = useLocale();
  const resolvedDefaultCurrency = resolveDefaultCurrency(defaultCurrency);

  const [mode, setMode] = useState<StatementExpenseMode>('scan');
  const [manualStep, setManualStep] = useState<ManualStep>('amount');
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [taxRateDrawerOpen, setTaxRateDrawerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [manualRecentCurrencies, setManualRecentCurrencies] = useState<string[]>([
    ...DEFAULT_RECENT_CURRENCIES,
  ]);
  const [files, setFiles] = useState<File[]>([]);
  const [manualDraft, setManualDraft] = useState<ManualExpenseDraft>(() =>
    createDefaultManualDraft(resolvedDefaultCurrency),
  );
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualAmountInputRef = useRef<HTMLInputElement>(null);
  const locationRequestRef = useRef<Promise<DeviceLocation | null> | null>(null);

  const currencyItems = useMemo(() => buildCurrencySearchIndex(), []);
  const currencyByCode = useMemo(
    () => new Map(currencyItems.map(item => [item.code, item])),
    [currencyItems],
  );
  const selectedCurrencyItem = currencyByCode.get(manualDraft.currency);
  const selectedCurrencySymbol = selectedCurrencyItem?.symbol ?? manualDraft.currency;

  const manualAmountFontSize = useMemo(
    () => computeManualAmountFontSize(manualDraft.amount),
    [manualDraft.amount],
  );
  const flatCategories = useMemo(
    () => flattenStatementCategories(categories, '', locale),
    [categories, locale],
  );
  const selectedCategoryName = useMemo(
    () => flatCategories.find(category => category.id === manualDraft.categoryId)?.name ?? '',
    [flatCategories, manualDraft.categoryId],
  );
  const defaultTaxRate = useMemo(
    () =>
      taxRates.find(taxRate => taxRate.isEnabled && taxRate.isDefault) ||
      taxRates.find(taxRate => taxRate.isEnabled) ||
      null,
    [taxRates],
  );
  const selectedTaxRate = useMemo(() => {
    if (!manualDraft.taxRateId) {
      return defaultTaxRate;
    }
    return taxRates.find(taxRate => taxRate.id === manualDraft.taxRateId) || null;
  }, [manualDraft.taxRateId, taxRates, defaultTaxRate]);

  const enabledTaxRates = useMemo(() => taxRates.filter(taxRate => taxRate.isEnabled), [taxRates]);

  const currencyQuery = currencySearch.trim().toLowerCase();

  const selectedMatchesSearch = useMemo(() => {
    if (!selectedCurrencyItem) {
      return false;
    }
    if (!currencyQuery) {
      return true;
    }
    return selectedCurrencyItem.searchText.includes(currencyQuery);
  }, [selectedCurrencyItem, currencyQuery]);

  const recentCurrencyItems = useMemo(
    () =>
      manualRecentCurrencies
        .map(code => currencyByCode.get(code))
        .filter((item): item is CurrencySearchItem => Boolean(item))
        .filter(item => item.code !== manualDraft.currency),
    [manualRecentCurrencies, currencyByCode, manualDraft.currency],
  );

  const allCurrencyItems = useMemo(() => {
    const source =
      currencyQuery.length > 0
        ? currencyItems.filter(item => item.searchText.includes(currencyQuery))
        : currencyItems;
    return source.filter(item => item.code !== manualDraft.currency);
  }, [currencyItems, currencyQuery, manualDraft.currency]);

  const hasManualAmount = useMemo(
    () => hasPositiveManualAmount(manualDraft.amount),
    [manualDraft.amount],
  );

  const manualValidation = useMemo(() => validateManualExpenseDraft(manualDraft), [manualDraft]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSubmitting(false);
      return;
    }

    const resolvedMode = resolveExpenseDrawerMode(initialMode);
    setMode(resolvedMode);
    setManualStep('amount');
    setCurrencyPickerOpen(false);
    setCategoryDrawerOpen(false);
    setTaxRateDrawerOpen(false);
    setCurrencySearch('');
    setManualDraft(createDefaultManualDraft(resolvedDefaultCurrency));
  }, [open, initialMode, resolvedDefaultCurrency]);

  const pushRecentCurrency = (currencyCode: string): void => {
    setManualRecentCurrencies(prev => [
      currencyCode,
      ...prev.filter(item => item !== currencyCode),
    ]);
  };

  const handleSelectCurrency = (currencyCode: string): void => {
    setManualDraft(prev => ({ ...prev, currency: currencyCode }));
    pushRecentCurrency(currencyCode);
    setCurrencySearch('');
    setCurrencyPickerOpen(false);
  };

  const handleClose = (): void => {
    setMode('scan');
    setManualStep('amount');
    setCurrencyPickerOpen(false);
    setCategoryDrawerOpen(false);
    setTaxRateDrawerOpen(false);
    setCurrencySearch('');
    setFiles([]);
    setManualDraft(createDefaultManualDraft(resolvedDefaultCurrency));
    setManualDate(new Date().toISOString().slice(0, 10));
    setError(null);
    setSubmitting(false);
    onClose();
  };

  // eslint-disable-next-line complexity
  const handleBackClick = (): void => {
    if (categoryDrawerOpen) {
      setCategoryDrawerOpen(false);
      return;
    }
    if (taxRateDrawerOpen) {
      setTaxRateDrawerOpen(false);
      return;
    }
    if (mode === 'manual' && currencyPickerOpen) {
      setCurrencyPickerOpen(false);
      setCurrencySearch('');
      return;
    }
    if (mode === 'manual' && manualStep === 'details') {
      setManualStep('amount');
      return;
    }
    handleClose();
  };

  const handleFilesSelected = (
    selected: FileList | File[] | null,
    origin: SelectedFilesOrigin = 'gallery',
  ): void => {
    if (!selected) {
      return;
    }
    // Only for a fresh camera shot the user agreed to tag (the consent screen
    // before the first shot, or Settings). A gallery photo may be days old and
    // taken anywhere, so it never gets a device point.
    locationRequestRef.current =
      origin === 'camera' && getReceiptLocationCapture() === 'on' ? getDeviceLocation() : null;
    setFiles(Array.from(selected));
    setError(null);
  };

  const handleManualNext = (): void => {
    if (!hasManualAmount) {
      setError('Enter a valid amount');
      return;
    }
    setError(null);
    setManualStep('details');
  };

  const handleSubmitScan = async (): Promise<void> => {
    if (files.length === 0) {
      setError('Choose at least one file');
      return;
    }

    const filesToUpload = files;
    const locationRequest = locationRequestRef.current;
    locationRequestRef.current = null;
    setError(null);
    handleClose();

    // Handed over unresolved: the list shows the placeholder rows at once, not
    // after the location lookup.
    await onSubmitScan({
      files: filesToUpload,
      allowDuplicates: ALWAYS_ALLOW_STATEMENT_DUPLICATES,
      requireManualCategorySelection: false,
      deviceLocationRequest: locationRequest,
    }).catch(async (submitError: unknown) => {
      toast.error(getApiErrorMessage(submitError, 'Failed to upload files'));
    });
  };

  const handleSubmitManual = async (): Promise<void> => {
    if (!(manualValidation.amount && manualValidation.merchant && manualValidation.category)) {
      setError('Amount, merchant, and category are required');
      return;
    }

    setSubmitting(true);
    setError(null);

    await (async () => {
      await onSubmitManual({
        draft: manualDraft,
        date: manualDate,
        files,
        allowDuplicates: ALWAYS_ALLOW_STATEMENT_DUPLICATES,
      });
      handleClose();
    })()
      .catch(async (submitError: unknown) => {
        setError(getApiErrorMessage(submitError, 'Failed to submit manual expense'));
      })
      .finally(async () => {
        setSubmitting(false);
      });
  };

  return {
    mode,
    setMode,
    manualStep,
    setManualStep,
    currencyPickerOpen,
    setCurrencyPickerOpen,
    categoryDrawerOpen,
    setCategoryDrawerOpen,
    taxRateDrawerOpen,
    setTaxRateDrawerOpen,
    currencySearch,
    setCurrencySearch,
    files,
    setFiles,
    manualDraft,
    setManualDraft,
    manualDate,
    setManualDate,
    submitting,
    error,
    setError,
    fileInputRef,
    manualAmountInputRef,
    selectedCurrencyItem,
    selectedCurrencySymbol,
    manualAmountFontSize,
    flatCategories,
    selectedCategoryName,
    defaultTaxRate,
    selectedTaxRate,
    enabledTaxRates,
    selectedMatchesSearch,
    recentCurrencyItems,
    allCurrencyItems,
    hasManualAmount,
    manualValidation,
    handleSelectCurrency,
    handleClose,
    handleBackClick,
    handleFilesSelected,
    handleManualNext,
    handleSubmitScan,
    handleSubmitManual,
  };
}
