'use client';

import { Button, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useQuery } from '@tanstack/react-query';
import { format, isValid, parseISO } from 'date-fns';
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { fetchBudgets } from '@/app/(main)/budgets/hooks/useBudgetsPage';
import { ChevronLeft } from '@/app/components/icons';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { queryKeys } from '@/app/lib/query-keys';
import {
  buildCurrencySearchIndex,
  type CurrencySearchItem,
  DEFAULT_RECENT_CURRENCIES,
} from '@/app/lib/statement-expense-drawer';
import { tokens } from '@/lib/theme-tokens';
import type { SubscriptionFormData } from '../hooks/useSubscriptionsPage';
import { SubscriptionPayments } from './SubscriptionPayments';

interface SubscriptionFormDrawerProps {
  open: boolean;
  formData: SubscriptionFormData;
  setFormData: Dispatch<SetStateAction<SubscriptionFormData>>;
  saving: boolean;
  isEditing: boolean;
  onSave: () => void;
  onClose: () => void;
}

const parseDateValue = (value: string): Date | null => {
  if (!value) {
    return null;
  }

  const date = parseISO(value);
  return isValid(date) ? date : null;
};

function useCurrencyPickerState(currency: string): {
  currencyDrawerOpen: boolean;
  setCurrencyDrawerOpen: (open: boolean) => void;
  currencySearch: string;
  setCurrencySearch: (value: string) => void;
  selectedCurrencyItem: CurrencySearchItem | undefined;
  selectedMatchesSearch: boolean;
  currencyQuery: string;
  recentCurrencyItems: CurrencySearchItem[];
  allCurrencyItems: CurrencySearchItem[];
  pushRecentCurrency: (code: string) => void;
} {
  const [currencyDrawerOpen, setCurrencyDrawerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>([
    ...DEFAULT_RECENT_CURRENCIES,
  ]);
  const currencyItems = useMemo(() => buildCurrencySearchIndex(), []);
  const currencyByCode = useMemo(
    () => new Map(currencyItems.map(item => [item.code, item])),
    [currencyItems],
  );
  const normalizedCurrency = currency.trim().toUpperCase();
  const selectedCurrencyItem = currencyByCode.get(normalizedCurrency);
  const currencyQuery = currencySearch.trim().toLowerCase();
  const selectedMatchesSearch = selectedCurrencyItem
    ? currencyQuery.length === 0 || selectedCurrencyItem.searchText.includes(currencyQuery)
    : false;
  const recentCurrencyItems = useMemo(
    () =>
      recentCurrencies
        .map(code => currencyByCode.get(code))
        .filter((item): item is CurrencySearchItem => Boolean(item))
        .filter(item => item.code !== normalizedCurrency),
    [currencyByCode, normalizedCurrency, recentCurrencies],
  );
  const allCurrencyItems = useMemo(() => {
    const source =
      currencyQuery.length > 0
        ? currencyItems.filter(item => item.searchText.includes(currencyQuery))
        : currencyItems;
    return source.filter(item => item.code !== normalizedCurrency);
  }, [currencyItems, currencyQuery, normalizedCurrency]);

  const pushRecentCurrency = (code: string): void => {
    setRecentCurrencies(prev => [code, ...prev.filter(item => item !== code)]);
    setCurrencySearch('');
    setCurrencyDrawerOpen(false);
  };

  return {
    currencyDrawerOpen,
    setCurrencyDrawerOpen,
    currencySearch,
    setCurrencySearch,
    selectedCurrencyItem,
    selectedMatchesSearch,
    currencyQuery,
    recentCurrencyItems,
    allCurrencyItems,
    pushRecentCurrency,
  };
}

export function SubscriptionFormDrawer({
  open,
  formData,
  setFormData,
  saving,
  isEditing,
  onSave,
  onClose,
}: SubscriptionFormDrawerProps): React.JSX.Element {
  const t = useIntlayer('subscriptionsPage');
  const workspaceId = useWorkspaceId();
  // The budgets page's own query: either one fills the other's cache.
  const budgets = useQuery({
    queryKey: queryKeys.budgets(workspaceId),
    queryFn: ({ signal }) => fetchBudgets(signal),
    enabled: open && Boolean(workspaceId),
  });
  const currencyPicker = useCurrencyPickerState(formData.currency || 'USD');
  const {
    currencyDrawerOpen,
    setCurrencyDrawerOpen,
    currencySearch,
    setCurrencySearch,
    selectedCurrencyItem,
    selectedMatchesSearch,
    currencyQuery,
    recentCurrencyItems,
    allCurrencyItems,
    pushRecentCurrency,
  } = currencyPicker;
  const canSave = Boolean(formData.vendorName && formData.amount);

  useEffect(() => {
    if (!open) {
      setCurrencyDrawerOpen(false);
      setCurrencySearch('');
    }
  }, [open, setCurrencyDrawerOpen, setCurrencySearch]);

  const handleSelectCurrency = (code: string): void => {
    setFormData({ ...formData, currency: code });
    pushRecentCurrency(code);
  };

  return (
    <>
      <DrawerShell
        isOpen={open}
        onClose={onClose}
        position="right"
        width="lg"
        showCloseButton={false}
        sx={{
          maxWidth: '100%',
          borderLeft: 0,
          bgcolor: 'background.paper',
          '@media (min-width:600px)': { maxWidth: 512 },
        }}
        title={
          <div className="seneca-payable-drawer__title-wrap">
            <button
              type="button"
              onClick={onClose}
              className="seneca-payable-drawer__back-btn"
              aria-label={t.cancel.value}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
              {isEditing ? t.editSubscription : t.addSubscription}
            </span>
          </div>
        }
      >
        <div className="seneca-payable-drawer__body">
          <div style={{ display: 'grid', gap: 16 }}>
            <TextField
              label={t.vendorName.value}
              value={formData.vendorName}
              onChange={event => setFormData({ ...formData, vendorName: event.target.value })}
              required
              fullWidth
            />

            <TextField
              label={t.amount.value}
              type="number"
              value={formData.amount}
              onChange={event =>
                setFormData({
                  ...formData,
                  amount: event.target.value ? Number(event.target.value) : '',
                })
              }
              required
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>{t.frequency}</InputLabel>
              <Select
                value={formData.frequency}
                label={t.frequency.value}
                onChange={event =>
                  setFormData({
                    ...formData,
                    frequency: event.target.value as SubscriptionFormData['frequency'],
                  })
                }
              >
                <MenuItem value="weekly">{t.weekly}</MenuItem>
                <MenuItem value="monthly">{t.monthly}</MenuItem>
                <MenuItem value="quarterly">{t.quarterly}</MenuItem>
                <MenuItem value="annual">{t.annual}</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={t.currency.value}
              value={formData.currency}
              fullWidth
              onClick={() => setCurrencyDrawerOpen(true)}
              sx={{ cursor: 'pointer', '& input': { cursor: 'pointer' } }}
              slotProps={{
                htmlInput: { readOnly: true },
              }}
            />

            <DatePicker
              label={t.nextChargeDate.value}
              value={parseDateValue(formData.nextChargeDate)}
              onChange={date =>
                setFormData({
                  ...formData,
                  nextChargeDate: date && isValid(date) ? format(date, 'yyyy-MM-dd') : '',
                })
              }
              slotProps={{
                textField: {
                  fullWidth: true,
                },
                openPickerButton: {
                  sx: { borderRadius: tokens.radius.md },
                },
              }}
            />

            {/* Optional: its payments then count in that budget. */}
            <FormControl fullWidth>
              <InputLabel id="subscription-budget-label">{t.budget}</InputLabel>
              <Select
                labelId="subscription-budget-label"
                value={formData.budgetId}
                label={t.budget.value}
                onChange={event => setFormData({ ...formData, budgetId: event.target.value })}
              >
                <MenuItem value="">{t.noBudget}</MenuItem>
                {(budgets.data ?? []).map(budget => (
                  <MenuItem key={budget.id} value={budget.id}>
                    {budget.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* A saved subscription's payments are kept in its card. */}
            {!isEditing && (
              <SubscriptionPayments
                payments={formData.payments}
                vendorName={formData.vendorName}
                defaultAmount={formData.amount}
                pickedTransactionIds={formData.payments.flatMap(payment =>
                  payment.transactionId ? [payment.transactionId] : [],
                )}
                onAddManual={(date, amount) =>
                  setFormData(current => ({
                    ...current,
                    payments: [
                      ...current.payments,
                      {
                        key: crypto.randomUUID(),
                        date,
                        amount,
                        currency: current.currency,
                        linked: false,
                        transactionId: null,
                      },
                    ],
                  }))
                }
                // A statement upload ends seconds later: add to the form as it is then.
                onAddRows={rows =>
                  setFormData(current => ({
                    ...current,
                    payments: [
                      ...current.payments,
                      ...rows.map(row => ({
                        key: row.transactionId,
                        date: row.transactionDate,
                        amount: row.amount,
                        currency: row.currency,
                        linked: true,
                        transactionId: row.transactionId,
                      })),
                    ],
                  }))
                }
                onRemove={key =>
                  setFormData(current => ({
                    ...current,
                    payments: current.payments.filter(payment => payment.key !== key),
                  }))
                }
              />
            )}
          </div>

          <div className="seneca-payable-drawer__footer">
            <Button variant="outlined" sx={{ flex: 1 }} onClick={onClose} disabled={saving}>
              {t.cancel}
            </Button>
            <Button
              variant="contained"
              sx={{ flex: 1 }}
              onClick={onSave}
              disabled={saving || !canSave}
            >
              {saving ? t.saving : t.save}
            </Button>
          </div>
        </div>
      </DrawerShell>

      <CurrencyDrawer
        isOpen={open && currencyDrawerOpen}
        onClose={() => setCurrencyDrawerOpen(false)}
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
    </>
  );
}
