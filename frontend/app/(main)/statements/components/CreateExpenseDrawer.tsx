'use client';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { useExpenseForm } from '@/app/(main)/statements/components/hooks/useExpenseForm';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  PencilLine,
  Receipt,
  ScanLine,
} from '@/app/components/icons';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { ReceiptLocationConsent } from '@/app/components/receipts/location/ReceiptLocationConsent';
import { Button } from '@/app/components/ui/button';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useIntlayer } from '@/app/i18n';
import { type DeviceLocation, isDeviceLocationSupported } from '@/app/lib/device-location';
import { getReceiptLocationCapture } from '@/app/lib/receipt-location-capture';
import { type StatementCategoryNode } from '@/app/lib/statement-categories';
import {
  type CreateTaxRatePayload,
  type ManualExpenseDraft,
  type StatementExpenseMode,
  sanitizeManualAmountInput,
  type TaxRateOption,
} from '@/app/lib/statement-expense-drawer';
import { tokens } from '@/lib/theme-tokens';
import { BudgetImpactNotice } from './BudgetImpactNotice';

type Props = {
  open: boolean;
  initialMode: StatementExpenseMode;
  defaultCurrency?: string | null;
  categories: StatementCategoryNode[];
  taxRates: TaxRateOption[];
  onClose: () => void;
  onSubmitScan: (payload: {
    files: File[];
    allowDuplicates: boolean;
    requireManualCategorySelection: boolean;
    deviceLocationRequest: Promise<DeviceLocation | null> | null;
  }) => Promise<void>;
  onSubmitManual: (payload: {
    draft: ManualExpenseDraft;
    date: string;
    files: File[];
    allowDuplicates: boolean;
  }) => Promise<void>;
  onCreateTaxRate?: (payload: CreateTaxRatePayload) => Promise<TaxRateOption>;
};

/**
 * One field of the "Confirm details" form: a label above a flat control, and a
 * validation message under it. Picker fields render a button styled as the same
 * control; its chevron marks that it opens a sub-drawer.
 */
function DetailField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="lumio-expense-drawer__field">
      <label id={`${id}-label`} htmlFor={id} className="lumio-expense-drawer__label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="lumio-expense-drawer__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** "25.5%", not "26%": a rate rounded for display reads as a different rate. */
function formatTaxPercent(rate: number | string | null | undefined): string {
  return `${Number(rate || 0)}%`;
}

function controlClass(invalid: boolean, button = false): string {
  return [
    'lumio-expense-drawer__control',
    button ? 'lumio-expense-drawer__control--button' : '',
    invalid ? 'lumio-expense-drawer__control--invalid' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function PickerButton({
  id,
  invalid = false,
  placeholder = false,
  amount = false,
  onClick,
  children,
}: {
  id: string;
  invalid?: boolean;
  /** The value is a hint ("Optional", "Select category…"), not a chosen value. */
  placeholder?: boolean;
  amount?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const valueClass = [
    'lumio-expense-drawer__value',
    placeholder ? 'lumio-expense-drawer__value--placeholder' : '',
    amount ? 'lumio-expense-drawer__value--amount' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      // Named by label + current value, e.g. "Tax Optional", like the list row it replaced.
      aria-labelledby={`${id}-label ${id}-value`}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      className={controlClass(invalid, true)}
    >
      <span id={`${id}-value`} className={valueClass}>
        {children}
      </span>
      <ChevronRight size={20} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
    </button>
  );
}

export default function CreateExpenseDrawer({
  open,
  initialMode,
  defaultCurrency,
  categories,
  taxRates,
  onClose,
  onSubmitScan,
  onSubmitManual,
  onCreateTaxRate,
}: Props) {
  const isMobile = useIsMobile();
  const t = useIntlayer('statementsCreateExpenseDrawer');
  const scanCameraInputRef = useRef<HTMLInputElement>(null);
  const scanGalleryInputRef = useRef<HTMLInputElement>(null);
  // Shown instead of the camera the first time, until this device has a choice.
  const [locationConsentOpen, setLocationConsentOpen] = useState(false);
  // A file is being dragged over the window; lights up the drop zone.
  const [dragActive, setDragActive] = useState(false);
  useEffect(() => {
    if (!open) {
      setLocationConsentOpen(false);
      setDragActive(false);
    }
  }, [open]);
  const openCamera = (): void => {
    scanCameraInputRef.current?.click();
    setLocationConsentOpen(false);
  };
  const handleTakePhoto = (): void => {
    if (getReceiptLocationCapture() === null && isDeviceLocationSupported()) {
      setLocationConsentOpen(true);
      return;
    }
    openCamera();
  };
  const [createdTaxRates, setCreatedTaxRates] = useState<TaxRateOption[]>([]);
  const mergedTaxRates = useMemo(() => {
    const existingIds = new Set(taxRates.map(taxRate => taxRate.id));
    return [...taxRates, ...createdTaxRates.filter(taxRate => !existingIds.has(taxRate.id))];
  }, [taxRates, createdTaxRates]);
  const {
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
  } = useExpenseForm({
    open,
    initialMode,
    defaultCurrency,
    categories,
    taxRates: mergedTaxRates,
    onClose,
    onSubmitScan,
    onSubmitManual,
  });
  // In scan mode the whole window takes a dropped receipt: the drawer is modal, so a
  // file that misses the dashed zone would otherwise be opened by the browser in a new tab.
  useEffect(() => {
    if (!open || mode !== 'scan' || isMobile) {
      return;
    }
    const handleDragOver = (event: DragEvent): void => {
      if (!event.dataTransfer?.types.includes('Files')) {
        return;
      }
      event.preventDefault();
      setDragActive(true);
    };
    const handleDragLeave = (event: DragEvent): void => {
      // relatedTarget is null only when the pointer leaves the window.
      if (event.relatedTarget === null) {
        setDragActive(false);
      }
    };
    const handleDrop = (event: DragEvent): void => {
      event.preventDefault();
      setDragActive(false);
      // Same types the "Choose files" picker accepts.
      const receipts = Array.from(event.dataTransfer?.files ?? []).filter(
        file => file.type.startsWith('image/') || file.type === 'application/pdf',
      );
      if (receipts.length > 0) {
        handleFilesSelected(receipts);
      }
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [open, mode, isMobile, handleFilesSelected]);
  // Field errors wait for the first "Create" press; an untouched form is not wrong yet.
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  useEffect(() => {
    if (!open) {
      setShowFieldErrors(false);
    }
  }, [open]);
  const merchantError =
    showFieldErrors && !manualValidation.merchant ? t.fieldRequired.value : null;
  const categoryError =
    showFieldErrors && !manualValidation.category ? t.fieldRequired.value : null;
  const [taxRateName, setTaxRateName] = useState('');
  const [taxRateValue, setTaxRateValue] = useState('');
  const [taxRateSaving, setTaxRateSaving] = useState(false);
  const [taxRateError, setTaxRateError] = useState<string | null>(null);

  const currencyQuery = currencySearch.trim().toLowerCase();

  useEffect(() => {
    if (!taxRateDrawerOpen) {
      setTaxRateName('');
      setTaxRateValue('');
      setTaxRateError(null);
      setTaxRateSaving(false);
    }
  }, [taxRateDrawerOpen]);

  useEffect(() => {
    if (!open) {
      setCreatedTaxRates([]);
    }
  }, [open]);

  const handleCreateTaxRate = async (): Promise<void> => {
    const name = taxRateName.trim();
    const rate = Number(taxRateValue);

    if (!name) {
      setTaxRateError(t.taxRateNameRequired.value);
      return;
    }

    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setTaxRateError(t.taxPercentageRange.value);
      return;
    }

    if (!onCreateTaxRate) {
      setTaxRateError(t.taxRateUnavailable.value);
      return;
    }

    setTaxRateSaving(true);
    setTaxRateError(null);

    await (async () => {
      const created = await onCreateTaxRate({ name, rate, isEnabled: true });
      const normalizedCreated = {
        ...created,
        rate: Number(created.rate ?? rate),
        isEnabled: created.isEnabled !== false,
      };
      setCreatedTaxRates(prev => [normalizedCreated, ...prev]);
      setManualDraft(prev => ({
        ...prev,
        taxRateId: normalizedCreated.id,
      }));
      setTaxRateDrawerOpen(false);
    })()
      .catch(async (createError: unknown) => {
        const message =
          createError instanceof Error ? createError.message : t.taxRateSaveFailed.value;
        setTaxRateError(message);
      })
      .finally(async () => {
        setTaxRateSaving(false);
      });
  };

  return (
    <>
      <DrawerShell
        isOpen={open}
        onClose={handleClose}
        position="right"
        width="lg"
        showCloseButton={false}
        title={
          <div className="lumio-payable-drawer__title-wrap">
            <button
              type="button"
              onClick={handleBackClick}
              className="lumio-col-drawer__back-btn"
              aria-label={t.closeDrawer.value}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
              {mode === 'manual' && manualStep === 'details' ? t.confirmDetails : t.createExpense}
            </span>
          </div>
        }
      >
        <div className="lumio-expense-drawer">
          <div className="lumio-expense-drawer__tabs">
            <button
              type="button"
              onClick={() => {
                setMode('manual');
                setManualStep('amount');
                setCurrencyPickerOpen(false);
              }}
              className={`lumio-expense-drawer__tab${mode === 'manual' ? ' lumio-expense-drawer__tab--active' : ''}`}
            >
              <PencilLine size={16} />
              {t.manualTab}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('scan');
                setCurrencyPickerOpen(false);
              }}
              className={`lumio-expense-drawer__tab${mode === 'scan' ? ' lumio-expense-drawer__tab--active' : ''}`}
            >
              <ScanLine size={16} />
              {t.scanTab}
            </button>
          </div>

          <div className="lumio-expense-drawer__content">
            {mode === 'scan' ? (
              isMobile ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    borderRadius: tokens.radius.lg,
                    border: '1px solid var(--border-color)',
                    background: 'rgba(0,0,0,0.04)',
                    padding: 16,
                  }}
                >
                  {locationConsentOpen ? (
                    <ReceiptLocationConsent onOpenCamera={openCamera} />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleTakePhoto}
                        style={{
                          display: 'flex',
                          minHeight: 72,
                          width: '100%',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 12,
                          borderRadius: tokens.radius.md,
                          border: 'none',
                          background: 'var(--primary-fill)',
                          padding: '16px 20px',
                          fontSize: 18,
                          fontWeight: 700,
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <Camera size={20} />
                        {t.takePhoto}
                      </button>
                      <button
                        type="button"
                        onClick={() => scanGalleryInputRef.current?.click()}
                        style={{
                          display: 'flex',
                          minHeight: 72,
                          width: '100%',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 12,
                          borderRadius: tokens.radius.md,
                          border: '1px solid var(--border-color)',
                          background: 'var(--card-bg)',
                          padding: '16px 20px',
                          fontSize: 18,
                          fontWeight: 700,
                          color: 'var(--foreground)',
                          cursor: 'pointer',
                        }}
                      >
                        <ImageIcon size={20} />
                        {t.chooseFromGallery}
                      </button>
                    </>
                  )}
                  <input
                    ref={scanCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={event => handleFilesSelected(event.target.files, 'camera')}
                  />
                  <input
                    ref={scanGalleryInputRef}
                    type="file"
                    accept="image/*,.pdf,.xml"
                    style={{ display: 'none' }}
                    multiple
                    onChange={event => handleFilesSelected(event.target.files)}
                  />
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    cursor: 'pointer',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: tokens.radius.lg,
                    border: '2px dashed',
                    borderColor: dragActive
                      ? 'var(--primary)'
                      : 'color-mix(in srgb, var(--primary) 40%, transparent)',
                    background: dragActive
                      ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
                      : 'rgba(0,0,0,0.04)',
                    padding: '48px 24px',
                    textAlign: 'center',
                  }}
                >
                  <Receipt size={56} style={{ color: 'var(--muted-foreground)' }} />
                  <p
                    style={{
                      marginTop: 24,
                      fontSize: 30,
                      fontWeight: 600,
                      lineHeight: 1,
                      color: 'var(--foreground)',
                    }}
                  >
                    {t.uploadReceipts}
                  </p>
                  <p style={{ marginTop: 8, fontSize: 14, color: 'var(--muted-foreground)' }}>
                    {t.dragAndDrop}
                  </p>
                  <span
                    style={{
                      marginTop: 24,
                      display: 'inline-flex',
                      borderRadius: tokens.radius.md,
                      background: 'var(--primary-fill)',
                      padding: '10px 28px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#fff',
                    }}
                  >
                    {t.chooseFiles}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    capture="environment"
                    style={{ display: 'none' }}
                    multiple
                    onChange={event => handleFilesSelected(event.target.files)}
                  />
                </label>
              )
            ) : manualStep === 'amount' ? (
              <div
                style={{
                  display: 'flex',
                  minHeight: '100%',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flex: 1,
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <label htmlFor="expense-manual-amount" className="sr-only">
                    {t.amount}
                  </label>
                  <div style={{ margin: '0 auto', width: 290, maxWidth: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        height: 96,
                        width: '100%',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          lineHeight: 1,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                          fontSize: manualAmountFontSize,
                        }}
                      >
                        {selectedCurrencySymbol}
                      </span>
                      <input
                        ref={manualAmountInputRef}
                        // biome-ignore lint/a11y/noAutofocus: amount is the step's sole input; drawer opens for typing
                        autoFocus
                        id="expense-manual-amount"
                        inputMode="decimal"
                        value={manualDraft.amount}
                        onChange={event =>
                          setManualDraft(prev => ({
                            ...prev,
                            amount: sanitizeManualAmountInput(event.target.value),
                          }))
                        }
                        placeholder="0"
                        style={{
                          minWidth: 0,
                          flex: 1,
                          border: 0,
                          outline: 'none',
                          background: 'transparent',
                          padding: 0,
                          lineHeight: 1,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                          fontSize: manualAmountFontSize,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrencyPickerOpen(true)}
                      style={{
                        marginTop: 48,
                        display: 'inline-flex',
                        height: 64,
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        borderRadius: tokens.radius.md,
                        border: '1px solid var(--border-color, var(--border-color))',
                        background: 'var(--muted)',
                        padding: '0 24px',
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        cursor: 'pointer',
                      }}
                    >
                      {manualDraft.currency}
                      <ChevronDown size={20} style={{ color: 'var(--muted-foreground)' }} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <label className="lumio-expense-drawer__attach">
                  <FileText size={18} style={{ flexShrink: 0, color: 'var(--muted-foreground)' }} />
                  <span>{t.attachFile}</span>
                  <span className="lumio-expense-drawer__attach-hint">{t.attachFileHint}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.csv,.xlsx,.xls,.ofx,.qfx,.qif,.xml,.mt940,.sta,.940"
                    capture="environment"
                    className="lumio-expense-drawer__attach-input"
                    multiple
                    onChange={event => handleFilesSelected(event.target.files)}
                  />
                </label>

                <div className="lumio-expense-drawer__fields">
                  <DetailField id="expense-manual-amount-edit" label={t.amount.value}>
                    <PickerButton
                      id="expense-manual-amount-edit"
                      amount
                      onClick={() => setManualStep('amount')}
                    >
                      {selectedCurrencySymbol}
                      {manualDraft.amount || '0.00'}
                    </PickerButton>
                  </DetailField>

                  <DetailField id="expense-manual-description" label={t.description.value}>
                    <input
                      id="expense-manual-description"
                      value={manualDraft.description}
                      onChange={event =>
                        setManualDraft(prev => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      placeholder={t.optional.value}
                      className={controlClass(false)}
                    />
                  </DetailField>

                  <DetailField
                    id="expense-manual-merchant"
                    label={t.merchant.value}
                    error={merchantError}
                  >
                    <input
                      id="expense-manual-merchant"
                      value={manualDraft.merchant}
                      onChange={event =>
                        setManualDraft(prev => ({
                          ...prev,
                          merchant: event.target.value,
                        }))
                      }
                      placeholder={t.merchantPlaceholder.value}
                      aria-invalid={merchantError !== null || undefined}
                      aria-describedby={merchantError ? 'expense-manual-merchant-error' : undefined}
                      className={controlClass(merchantError !== null)}
                    />
                  </DetailField>

                  <DetailField
                    id="expense-manual-category"
                    label={t.category.value}
                    error={categoryError}
                  >
                    <PickerButton
                      id="expense-manual-category"
                      invalid={categoryError !== null}
                      placeholder={!selectedCategoryName}
                      onClick={() => setCategoryDrawerOpen(true)}
                    >
                      {selectedCategoryName || t.selectCategory}
                    </PickerButton>
                  </DetailField>
                  <BudgetImpactNotice
                    categoryId={manualDraft.categoryId}
                    amount={manualDraft.amount}
                    currency={manualDraft.currency}
                    date={manualDate}
                  />

                  <DetailField id="expense-manual-date" label={t.date.value}>
                    <div className={controlClass(false)}>
                      <DatePicker
                        value={manualDate ? parseISO(manualDate) : null}
                        onChange={(d: Date | null) =>
                          setManualDate(d && isValid(d) ? format(d, 'yyyy-MM-dd') : '')
                        }
                        slotProps={{
                          textField: {
                            id: 'expense-manual-date',
                            fullWidth: true,
                            variant: 'standard',
                            InputProps: { disableUnderline: true },
                            inputProps: { 'aria-label': t.date.value },
                            sx: {
                              '& .MuiInputBase-input': {
                                p: 0,
                                fontSize: 16,
                                color: 'var(--foreground)',
                              },
                            },
                          } as never,
                        }}
                      />
                    </div>
                  </DetailField>

                  <DetailField id="expense-manual-tax" label={t.tax.value}>
                    <PickerButton
                      id="expense-manual-tax"
                      placeholder={!selectedTaxRate}
                      onClick={() => setTaxRateDrawerOpen(true)}
                    >
                      {selectedTaxRate
                        ? `${selectedTaxRate.name} (${formatTaxPercent(selectedTaxRate.rate)})${selectedTaxRate.isDefault ? t.defaultSuffix.value : ''}`
                        : t.optional}
                    </PickerButton>
                  </DetailField>
                </div>
              </>
            )}

            {files.length > 0 ? (
              <div
                style={{
                  borderRadius: tokens.radius.lg,
                  border: '1px solid var(--border-color, var(--border-color))',
                  background: 'var(--card-bg, #fff)',
                  padding: '12px',
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  {t.selectedFiles}
                </p>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {files.map(file => (
                    <div
                      key={`${file.name}-${file.size}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: tokens.radius.sm,
                        border: '1px solid var(--border-color, var(--border-color))',
                        padding: '8px 12px',
                        fontSize: 14,
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--foreground)',
                        }}
                      >
                        {file.name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? (
              <div
                style={{
                  borderRadius: tokens.radius.sm,
                  border: '1px solid #fecaca',
                  background: 'var(--color-error-soft-bg)',
                  padding: '8px 12px',
                  fontSize: 14,
                  color: 'var(--destructive)',
                }}
              >
                {error}
              </div>
            ) : null}
          </div>

          <div style={{ paddingTop: 16 }}>
            <Button
              type="button"
              size="lg"
              style={{ width: '100%', borderRadius: tokens.radius.md }}
              disabled={
                submitting ||
                locationConsentOpen ||
                currencyPickerOpen ||
                categoryDrawerOpen ||
                taxRateDrawerOpen ||
                (mode === 'manual' && manualStep === 'amount' && !hasManualAmount)
              }
              onClick={
                mode === 'scan'
                  ? handleSubmitScan
                  : manualStep === 'amount'
                    ? handleManualNext
                    : () => {
                        setShowFieldErrors(true);
                        void handleSubmitManual();
                      }
              }
            >
              {submitting
                ? t.saving
                : mode === 'scan'
                  ? t.uploadReceipt
                  : manualStep === 'amount'
                    ? t.next
                    : t.createAmountExpense.value.replace(
                        '{amount}',
                        `${selectedCurrencySymbol}${manualDraft.amount || '0.00'}`,
                      )}
            </Button>
          </div>
        </div>
      </DrawerShell>

      <CurrencyDrawer
        isOpen={open && currencyPickerOpen}
        onClose={() => {
          setCurrencyPickerOpen(false);
          setCurrencySearch('');
        }}
        currencySearch={currencySearch}
        setCurrencySearch={setCurrencySearch}
        selectedCurrencyItem={selectedCurrencyItem}
        selectedMatchesSearch={selectedMatchesSearch}
        currencyQuery={currencyQuery}
        recentCurrencyItems={recentCurrencyItems}
        allCurrencyItems={allCurrencyItems}
        handleSelectCurrency={handleSelectCurrency}
        zIndex={1400}
      />

      <StatementCategoryDrawer
        open={open && mode === 'manual' && manualStep === 'details' && categoryDrawerOpen}
        onClose={() => setCategoryDrawerOpen(false)}
        categories={categories}
        selectedCategoryId={manualDraft.categoryId}
        selecting={false}
        onSelect={categoryId => {
          setManualDraft(prev => ({
            ...prev,
            categoryId,
          }));
          setCategoryDrawerOpen(false);
          setError(null);
        }}
        labels={{
          title: t.category.value,
          searchPlaceholder: t.searchCategories.value,
          allOption: t.noCategory.value,
          noResults: t.noCategoriesFound.value,
        }}
        width="lg"
        showAllOption={false}
      />

      <DrawerShell
        isOpen={open && mode === 'manual' && manualStep === 'details' && taxRateDrawerOpen}
        onClose={() => setTaxRateDrawerOpen(false)}
        position="right"
        width="lg"
        showCloseButton={false}
        title={
          <div className="lumio-payable-drawer__title-wrap">
            <button
              type="button"
              onClick={() => setTaxRateDrawerOpen(false)}
              className="lumio-col-drawer__back-btn"
              aria-label={t.closeTaxRateDrawer.value}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
              {t.taxRate}
            </span>
          </div>
        }
      >
        <div className="lumio-tax-drawer">
          <div className="lumio-tax-drawer__form">
            <div className="lumio-tax-drawer__form-row">
              <DetailField id="expense-tax-rate-name" label={t.taxRateName.value}>
                <input
                  id="expense-tax-rate-name"
                  value={taxRateName}
                  onChange={event => setTaxRateName(event.target.value)}
                  placeholder={t.taxRateNamePlaceholder.value}
                  className={controlClass(false)}
                />
              </DetailField>
              <DetailField id="expense-tax-rate-percentage" label={t.taxPercentage.value}>
                <div className={controlClass(false)}>
                  <input
                    id="expense-tax-rate-percentage"
                    value={taxRateValue}
                    onChange={event => setTaxRateValue(event.target.value)}
                    inputMode="decimal"
                    placeholder="12"
                    className="lumio-tax-drawer__percent-input"
                  />
                  <span aria-hidden className="lumio-tax-drawer__percent-sign">
                    %
                  </span>
                </div>
              </DetailField>
            </div>
            {taxRateError ? <p className="lumio-expense-drawer__error">{taxRateError}</p> : null}
            <Button
              type="button"
              variant="outline"
              disabled={taxRateSaving}
              onClick={() => void handleCreateTaxRate()}
              style={{ width: '100%', borderRadius: 8 }}
            >
              {taxRateSaving ? t.saving : t.saveTaxRate}
            </Button>
          </div>
          <div className="lumio-tax-drawer__list">
            {enabledTaxRates.map(taxRate => {
              const isSelected = manualDraft.taxRateId
                ? manualDraft.taxRateId === taxRate.id
                : defaultTaxRate?.id === taxRate.id;

              return (
                <button
                  key={taxRate.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setManualDraft(prev => ({
                      ...prev,
                      taxRateId: taxRate.id,
                    }));
                    setTaxRateDrawerOpen(false);
                  }}
                  className={`lumio-tax-drawer__option${isSelected ? ' lumio-tax-drawer__option--selected' : ''}`}
                >
                  <span className="lumio-tax-drawer__option-name">{taxRate.name}</span>
                  {taxRate.isDefault ? (
                    <span className="lumio-tax-drawer__tag">{t.defaultTag}</span>
                  ) : null}
                  <span className="lumio-tax-drawer__option-rate">
                    {formatTaxPercent(taxRate.rate)}
                  </span>
                  <span className="lumio-tax-drawer__option-check">
                    {isSelected ? <Check size={18} /> : null}
                  </span>
                </button>
              );
            })}
            {enabledTaxRates.length === 0 ? (
              <div className="lumio-tax-drawer__empty">{t.noTaxRates}</div>
            ) : null}
          </div>
        </div>
      </DrawerShell>
    </>
  );
}
