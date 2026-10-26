'use client';

import { Box, IconButton, Typography } from '@mui/material';
import MuiButton from '@mui/material/Button';
import { useTheme } from 'next-themes';
import { useMemo, useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { ChevronDown, Trash2 } from '@/app/components/icons';
import { FORM_CONTROL_SX, Input } from '@/app/components/ui/input';
import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import { DEFAULT_RECENT_CURRENCIES } from '@/app/lib/currency';
import { formatMoney } from '@/app/lib/format-money';
import {
  buildCurrencySearchIndex,
  type CurrencySearchItem,
} from '@/app/lib/statement-expense-drawer';
import { tokens } from '@/lib/theme-tokens';
import { CurrencyDrawer } from './components/CurrencyDrawer';
import { ReceiptTaxField } from './ReceiptTaxField';
import type { EditableReceiptParsedData, ReceiptCategoryOption } from './receipt-types';

/** Fields are stacked one per row so the form reads as a single column. */
const FORM_MAX_WIDTH = 520;

/** `compact`: two fields per row and 36px controls, so the whole form fits beside the document. */
const COMPACT_CONTROL_STYLE = { height: 36, fontSize: 14 } as const;

function Field({
  htmlFor,
  label,
  compact = false,
  children,
}: {
  htmlFor: string;
  label: string;
  compact?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Box>
      <Box
        component="label"
        htmlFor={htmlFor}
        sx={{
          display: 'block',
          mb: compact ? 0.5 : 0.75,
          fontSize: compact ? 13 : 14,
          fontWeight: 500,
          color: c.ink700,
        }}
      >
        {label}
      </Box>
      {children}
    </Box>
  );
}

/**
 * A line-item cell in compact mode: no fill and no box, just a hairline under
 * the value that turns green on focus, so a list of items reads as a table.
 */
function FlatLineInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { align?: 'left' | 'right' },
): React.ReactElement {
  const { align = 'left', ...inputProps } = props;
  return (
    <Box
      component="input"
      {...inputProps}
      sx={{
        width: '100%',
        height: 30,
        px: 0.5,
        border: 'none',
        borderBottom: '1px solid var(--border)',
        borderRadius: 0,
        bgcolor: 'transparent',
        color: 'text.primary',
        font: 'inherit',
        fontSize: 13,
        textAlign: align,
        outline: 'none',
        fontVariantNumeric: align === 'right' ? 'tabular-nums' : undefined,
        transition: 'border-color 120ms ease',
        '&:hover': { borderBottomColor: 'text.secondary' },
        '&:focus': { borderBottomColor: 'primary.main' },
      }}
    />
  );
}

export interface ReceiptParsedDataFormProps {
  value: EditableReceiptParsedData;
  categories: ReceiptCategoryOption[];
  onChange: (value: EditableReceiptParsedData) => void;
  onCurrencyChange?: (value: EditableReceiptParsedData) => void | Promise<void>;
  /** Two fields per row and shorter controls, for the full-page receipt view. */
  compact?: boolean;
  /** The receipt being edited: its transaction's tax rate is picked in the form. */
  receiptId?: string;
}

export function ReceiptParsedDataForm({
  value,
  categories,
  onChange,
  onCurrencyChange,
  compact = false,
  receiptId,
}: ReceiptParsedDataFormProps) {
  const { locale } = useLocale();
  const t = useIntlayer('receiptParsedDataForm');
  const tCurrency = useIntlayer('receiptCurrencyDrawer');
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const [currencyDrawerOpen, setCurrencyDrawerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>([
    ...DEFAULT_RECENT_CURRENCIES,
  ]);

  const currencyItems = useMemo(() => buildCurrencySearchIndex(), []);
  const currencyByCode = useMemo(
    () => new Map(currencyItems.map(item => [item.code, item] as const)),
    [currencyItems],
  );
  const selectedCurrencyItem = value.currency ? currencyByCode.get(value.currency) : null;
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
      recentCurrencies
        .map(code => currencyByCode.get(code))
        .filter((item): item is CurrencySearchItem => Boolean(item))
        .filter(item => item.code !== value.currency),
    [recentCurrencies, currencyByCode, value.currency],
  );

  const allCurrencyItems = useMemo(() => {
    const source =
      currencyQuery.length > 0
        ? currencyItems.filter(item => item.searchText.includes(currencyQuery))
        : currencyItems;

    return source.filter(item => item.code !== value.currency);
  }, [currencyItems, currencyQuery, value.currency]);

  const pushRecentCurrency = (currencyCode: string) => {
    setRecentCurrencies(prev => [currencyCode, ...prev.filter(item => item !== currencyCode)]);
  };

  const handleSelectCurrency = (currencyCode: string) => {
    const nextValue = { ...value, currency: currencyCode };

    onChange(nextValue);
    void onCurrencyChange?.(nextValue);
    pushRecentCurrency(currencyCode);
    setCurrencySearch('');
    setCurrencyDrawerOpen(false);
  };

  // Collapsed: most receipts are read for their total, and the items only matter
  // when a purchase is split across categories.
  const [itemsOpen, setItemsOpen] = useState(false);
  const addLineItem = () =>
    onChange({
      ...value,
      lineItems: [...value.lineItems, { id: `line-${Date.now()}`, description: '', amount: 0 }],
    });
  // How far the items are from the amount, like the remainder in an itemization.
  const itemsDifference =
    value.lineItems.length > 0 && value.amount !== '' && Number(value.amount) > 0
      ? Number(value.amount) -
        value.lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
      : null;

  const controlStyle = compact ? COMPACT_CONTROL_STYLE : undefined;
  const selectSx = compact ? COMPACT_CONTROL_STYLE : FORM_CONTROL_SX;
  const LineInput = compact ? FlatLineInput : Input;

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 2.5 : 4,
          maxWidth: compact ? 'none' : FORM_MAX_WIDTH,
        }}
      >
        <Box
          sx={
            compact
              ? {
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  columnGap: 1.5,
                  rowGap: 1,
                }
              : { display: 'flex', flexDirection: 'column', gap: 2.5 }
          }
        >
          <Field compact={compact} htmlFor="receipt-vendor" label={t.vendor.value}>
            <Input
              id="receipt-vendor"
              style={controlStyle}
              aria-label={t.vendor.value}
              value={value.vendor}
              onChange={event => onChange({ ...value, vendor: event.target.value })}
            />
          </Field>

          <Field compact={compact} htmlFor="receipt-date-picker" label={t.date.value}>
            <CustomDatePicker
              large={!compact}
              value={value.date}
              onChange={date => onChange({ ...value, date })}
              containerTestId="receipt-date-picker"
            />
          </Field>

          <Field compact={compact} htmlFor="receipt-amount" label={t.amount.value}>
            <Input
              id="receipt-amount"
              style={controlStyle}
              aria-label={t.amount.value}
              type="number"
              value={value.amount}
              onChange={event =>
                onChange({
                  ...value,
                  amount: event.target.value === '' ? '' : Number(event.target.value),
                })
              }
            />
          </Field>

          <Field compact={compact} htmlFor="receipt-currency-trigger" label={t.currency.value}>
            <Box
              component="button"
              id="receipt-currency-trigger"
              aria-label={t.currency.value}
              type="button"
              onClick={() => setCurrencyDrawerOpen(true)}
              sx={{
                display: 'flex',
                height: compact ? 36 : 48,
                width: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid',
                // MUI's own outlined-input border, so it matches the fields beside it in both themes.
                borderColor: theme =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.23)'
                    : 'rgba(0, 0, 0, 0.23)',
                borderRadius: tokens.radius.md,
                bgcolor: 'transparent',
                px: 1.75,
                fontSize: compact ? 14 : 16,
                cursor: 'pointer',
                '&:hover': { borderColor: 'text.primary' },
                '&:focus-visible': {
                  borderColor: 'primary.main',
                  boxShadow: `0 0 0 3px ${c.primary50}`,
                  outline: 'none',
                },
              }}
            >
              <Box
                component="span"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {selectedCurrencyItem?.code || value.currency || tCurrency.title}
              </Box>
              <ChevronDown style={{ width: 18, height: 18, color: c.ink400 }} />
            </Box>
          </Field>

          {receiptId ? (
            <Field compact={compact} htmlFor="receipt-tax" label={t.tax.value}>
              <ReceiptTaxField
                id="receipt-tax"
                receiptId={receiptId}
                date={value.date}
                currency={value.currency}
                sx={selectSx}
              />
            </Field>
          ) : null}

          <Field compact={compact} htmlFor="receipt-payment-method" label={t.paymentMethod.value}>
            <Select
              fullWidth
              id="receipt-payment-method"
              inputProps={{ 'aria-label': t.paymentMethod.value }}
              value={value.paymentMethod}
              onChange={paymentMethod => onChange({ ...value, paymentMethod })}
              options={[
                { value: '', label: t.selectPaymentMethod.value },
                { value: 'card', label: t.paymentCard.value },
                { value: 'cash', label: t.paymentCash.value },
                { value: 'bank_transfer', label: t.paymentBankTransfer.value },
                { value: 'other', label: t.paymentOther.value },
              ]}
              sx={selectSx}
            />
          </Field>

          <Field compact={compact} htmlFor="receipt-category" label={t.category.value}>
            <CategoryPickerField
              id="receipt-category"
              ariaLabel={t.category.value}
              value={value.categoryId}
              categories={categories}
              onChange={categoryId => onChange({ ...value, categoryId })}
              placeholder={t.selectCategory.value}
              size={compact ? 'compact' : 'medium'}
            />
          </Field>

          <Field
            compact={compact}
            htmlFor="receipt-transaction-type"
            label={t.transactionType.value}
          >
            <Select
              fullWidth
              id="receipt-transaction-type"
              inputProps={{ 'aria-label': t.transactionType.value }}
              value={value.transactionType}
              onChange={transactionType =>
                onChange({
                  ...value,
                  transactionType: transactionType as EditableReceiptParsedData['transactionType'],
                })
              }
              options={[
                { value: 'expense', label: t.typeExpense.value },
                { value: 'income', label: t.typeIncome.value },
                { value: 'transfer', label: t.typeTransfer.value },
                { value: 'unknown', label: t.typeUnknown.value },
              ]}
              sx={selectSx}
            />
          </Field>
        </Box>

        <Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: compact ? 0.75 : 1.5,
            }}
          >
            {value.lineItems.length > 0 ? (
              <MuiButton
                variant="text"
                size="small"
                aria-expanded={itemsOpen}
                onClick={() => setItemsOpen(open => !open)}
                endIcon={
                  <ChevronDown
                    size={16}
                    style={{ transform: itemsOpen ? 'rotate(180deg)' : undefined }}
                  />
                }
                sx={{ px: 0, minWidth: 0, fontSize: 14, fontWeight: 600, color: c.ink900 }}
              >
                {`${t.lineItems.value} (${value.lineItems.length})`}
              </MuiButton>
            ) : (
              <MuiButton
                variant="text"
                size="small"
                onClick={() => {
                  setItemsOpen(true);
                  addLineItem();
                }}
                sx={{ px: 0, minWidth: 0 }}
              >
                {t.itemize}
              </MuiButton>
            )}
            {itemsOpen && value.lineItems.length > 0 ? (
              <MuiButton variant="text" size="small" onClick={addLineItem}>
                {t.addItem}
              </MuiButton>
            ) : null}
          </Box>

          {itemsOpen && compact && value.lineItems.length > 0 ? (
            <Box
              aria-hidden
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) 110px 32px',
                gap: 1,
                px: 0.5,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: c.ink500,
              }}
            >
              <span>{t.description}</span>
              <span style={{ textAlign: 'right' }}>{t.price}</span>
              <span />
            </Box>
          ) : null}
          {itemsOpen ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: compact ? 0.25 : 1.5,
              }}
            >
              {value.lineItems.map((lineItem, index) => (
                <Box
                  key={lineItem.id}
                  sx={{
                    display: 'grid',
                    gap: compact ? 1 : 1.5,
                    gridTemplateColumns: compact
                      ? 'minmax(0,1fr) 110px 32px'
                      : { xs: '1fr', sm: 'minmax(0,1fr) 140px 48px' },
                    alignItems: 'center',
                  }}
                >
                  <LineInput
                    aria-label={index === 0 ? t.lineItemDescriptionLabel.value : undefined}
                    value={lineItem.description}
                    onChange={event =>
                      onChange({
                        ...value,
                        lineItems: value.lineItems.map(currentItem =>
                          currentItem.id === lineItem.id
                            ? { ...currentItem, description: event.target.value }
                            : currentItem,
                        ),
                      })
                    }
                  />
                  <LineInput
                    aria-label={index === 0 ? t.lineItemAmountLabel.value : undefined}
                    {...(compact ? { align: 'right' as const } : {})}
                    type="number"
                    value={lineItem.amount}
                    onChange={event =>
                      onChange({
                        ...value,
                        lineItems: value.lineItems.map(currentItem =>
                          currentItem.id === lineItem.id
                            ? { ...currentItem, amount: Number(event.target.value) }
                            : currentItem,
                        ),
                      })
                    }
                  />
                  <IconButton
                    aria-label={t.removeLineItem.value.replace(
                      '{name}',
                      lineItem.description || String(index + 1),
                    )}
                    size="small"
                    onClick={() =>
                      onChange({
                        ...value,
                        lineItems: value.lineItems.filter(
                          currentItem => currentItem.id !== lineItem.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          ) : null}
          {itemsOpen && itemsDifference !== null ? (
            <Typography
              role="status"
              style={{
                marginTop: 8,
                fontSize: 13,
                color: Math.abs(itemsDifference) < 0.005 ? c.ink500 : c.warning,
              }}
            >
              {Math.abs(itemsDifference) < 0.005
                ? t.itemsMatchTotal
                : fillTemplateNodes(t.itemsDifference.value, {
                    amount: formatMoney(Math.abs(itemsDifference), value.currency, locale),
                  })}
            </Typography>
          ) : null}
        </Box>
      </Box>

      <CurrencyDrawer
        isOpen={currencyDrawerOpen}
        onClose={() => {
          setCurrencyDrawerOpen(false);
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
      />
    </>
  );
}
