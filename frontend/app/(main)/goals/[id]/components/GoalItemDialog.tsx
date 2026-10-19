'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid as isValidDate, parse } from 'date-fns';
import type React from 'react';
import { useEffect, useState } from 'react';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { useCurrencyPickerState } from '@/app/hooks/useCurrencyPickerState';
import { useIntlayer } from '@/app/i18n';
import type { GoalItem, GoalItemPayload } from '@/app/lib/goals-api';

export interface GoalItemDialogProps {
  open: boolean;
  /** The line being edited, or null when adding a new one. */
  editing: GoalItem | null;
  /** Currency a new line defaults to — the goal's own. */
  defaultCurrency: string;
  saving: boolean;
  onSave: (payload: GoalItemPayload) => void;
  onClose: () => void;
}

interface FormState {
  name: string;
  estimatedAmount: string;
  actualAmount: string;
  currency: string;
  dueMonth: string;
  paid: boolean;
}

const emptyForm = (currency: string): FormState => ({
  name: '',
  estimatedAmount: '',
  actualAmount: '',
  currency,
  dueMonth: '',
  paid: false,
});

export function GoalItemDialog({
  open,
  editing,
  defaultCurrency,
  saving,
  onSave,
  onClose,
}: GoalItemDialogProps): React.JSX.Element {
  const t = useIntlayer('goalDetailPage');
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultCurrency));
  const picker = useCurrencyPickerState(form.currency);
  const openCurrencyDrawer = (): void => picker.setCurrencyDrawerOpen(true);

  // Reset on open rather than on every prop change: leaving a half-typed line
  // and reopening it should start from the stored values, not the last draft.
  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(
      editing
        ? {
            name: editing.name,
            estimatedAmount: String(editing.estimatedAmount),
            actualAmount: editing.actualAmount === null ? '' : String(editing.actualAmount),
            currency: editing.currency,
            dueMonth: editing.dueMonth ?? '',
            paid: editing.status === 'paid',
          }
        : emptyForm(defaultCurrency),
    );
  }, [open, editing, defaultCurrency]);

  const estimated = Number(form.estimatedAmount);
  const isValid = form.name.trim().length > 0 && Number.isFinite(estimated) && estimated >= 0;

  const handleSave = (): void => {
    onSave({
      name: form.name.trim(),
      estimatedAmount: estimated,
      // An empty field means "not paid yet", which the API reads as null rather
      // than as a cost of zero.
      actualAmount: form.actualAmount === '' ? null : Number(form.actualAmount),
      currency: form.currency,
      dueMonth: form.dueMonth === '' ? null : form.dueMonth,
      status: form.paid ? 'paid' : 'planned',
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{editing ? editing.name : t.itemsAdd}</DialogTitle>
      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pt: '16px !important',
        }}
      >
        <TextField
          label={t.itemName.value}
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          fullWidth
          size="small"
          autoFocus
        />

        <TextField
          label={t.itemsEstimate.value}
          type="number"
          value={form.estimatedAmount}
          onChange={e => setForm({ ...form, estimatedAmount: e.target.value })}
          fullWidth
          size="small"
        />

        <TextField
          label={t.actual.value}
          type="number"
          value={form.actualAmount}
          onChange={e => setForm({ ...form, actualAmount: e.target.value })}
          fullWidth
          size="small"
        />

        {/* Picked from the currency drawer, the same one payables and invoices
            use, rather than typed: a typed code could be anything. */}
        <TextField
          label={t.itemCurrency.value}
          value={picker.selectedCurrencyItem ? picker.selectedCurrencyItem.label : form.currency}
          onClick={openCurrencyDrawer}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openCurrencyDrawer();
            }
          }}
          fullWidth
          size="small"
          slotProps={{
            htmlInput: { readOnly: true, 'aria-haspopup': 'dialog', style: { cursor: 'pointer' } },
          }}
        />

        <DatePicker
          label={t.itemDueMonth.value}
          views={['year', 'month']}
          openTo="month"
          // LLLL is the standalone month: "октябрь 2026", not the genitive "октября".
          format="LLLL yyyy"
          value={form.dueMonth ? parse(form.dueMonth, 'yyyy-MM', new Date()) : null}
          onChange={date =>
            setForm({ ...form, dueMonth: date && isValidDate(date) ? format(date, 'yyyy-MM') : '' })
          }
          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={form.paid}
              onChange={e => setForm({ ...form, paid: e.target.checked })}
            />
          }
          label={t.itemsPaid.value}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t.itemCancel}
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid || saving}>
          {t.itemSave}
        </Button>
      </DialogActions>

      <CurrencyDrawer
        isOpen={picker.currencyDrawerOpen}
        onClose={() => {
          picker.setCurrencySearch('');
          picker.setCurrencyDrawerOpen(false);
        }}
        currencySearch={picker.currencySearch}
        setCurrencySearch={picker.setCurrencySearch}
        selectedCurrencyItem={picker.selectedCurrencyItem}
        selectedMatchesSearch={picker.selectedMatchesSearch}
        currencyQuery={picker.currencyQuery}
        recentCurrencyItems={picker.recentCurrencyItems}
        allCurrencyItems={picker.allCurrencyItems}
        handleSelectCurrency={code => {
          setForm(prev => ({ ...prev, currency: code }));
          picker.pushRecentCurrency(code);
        }}
        // Above the dialog (MUI modal 1300), as in CreateWorkspaceModal.
        zIndex={1400}
      />
    </Dialog>
  );
}
