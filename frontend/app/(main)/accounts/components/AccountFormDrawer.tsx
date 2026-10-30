'use client';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { useWorkspaceMembers } from '@/app/components/transactions/hooks/useWorkspaceMembers';
import { Select } from '@/app/components/ui/select';
import { useCurrencyPickerState } from '@/app/hooks/useCurrencyPickerState';
import { useIntlayer } from '@/app/i18n';
import type { WalletType } from '@/app/lib/contracts';
import { tokens } from '@/lib/theme-tokens';
import { ACCOUNT_TYPES, isDebtType } from '../account-types';
import type { AccountForm } from '../hooks/useAccounts';
import { AccountSideDrawer, Field } from './AccountSideDrawer';
import { useAccountLabels } from './use-account-labels';

const SHARED = 'shared';

interface AccountFormDrawerProps {
  open: boolean;
  /** Set when editing: the footer then offers archive and delete. */
  editing: boolean;
  initial: AccountForm;
  saving: boolean;
  onClose: () => void;
  onSave: (form: AccountForm) => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

/** Seven quiet tiles: the type decides where the account is listed and whether it is a debt. */
function TypePicker({
  value,
  onChange,
}: {
  value: WalletType;
  onChange: (type: WalletType) => void;
}): React.JSX.Element {
  const t = useIntlayer('accountsPage');
  const { types } = useAccountLabels();
  return (
    <Field label={t.typeLabel}>
      <div
        role="radiogroup"
        aria-label={t.typeLabel.value}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
          gap: 8,
        }}
      >
        {ACCOUNT_TYPES.map(({ type, icon: Icon }) => {
          const selected = type === value;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a tile with an icon, not a bare radio
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(type)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                padding: '10px 12px',
                borderRadius: tokens.radius.sm,
                border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                background: selected ? 'var(--primary-50)' : 'transparent',
                color: 'var(--foreground)',
                fontSize: 13,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <Icon size={18} aria-hidden />
              {types[type]}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function AccountFormDrawer({
  open,
  editing,
  initial,
  saving,
  onClose,
  onSave,
  onArchive,
  onDelete,
}: AccountFormDrawerProps): React.JSX.Element {
  const t = useIntlayer('accountsPage');
  const members = useWorkspaceMembers();
  const [form, setForm] = useState<AccountForm>(initial);
  const picker = useCurrencyPickerState(form.currency);

  // Start from the given values each time the drawer opens, not from the last draft.
  useEffect(() => {
    if (open) {
      setForm(initial);
    }
  }, [open, initial]);

  const set = (patch: Partial<AccountForm>) => setForm(prev => ({ ...prev, ...patch }));
  const openCurrency = () => picker.setCurrencyDrawerOpen(true);
  const debt = isDebtType(form.type);
  const canSave = form.name.trim().length > 0 && !saving;

  return (
    <>
      <AccountSideDrawer
        open={open}
        title={editing ? t.editAccount.value : t.newAccount.value}
        backLabel={t.cancel.value}
        onClose={onClose}
        footer={
          <>
            {editing && (
              <div style={{ display: 'flex', gap: 4, marginRight: 'auto' }}>
                <Button variant="text" onClick={onArchive} disabled={saving}>
                  {t.archive}
                </Button>
                <Button variant="text" onClick={onDelete} disabled={saving}>
                  {t.delete}
                </Button>
              </div>
            )}
            <Button variant="text" onClick={onClose} disabled={saving}>
              {t.cancel}
            </Button>
            <Button variant="contained" onClick={() => onSave(form)} disabled={!canSave}>
              {t.save}
            </Button>
          </>
        }
      >
        <TypePicker value={form.type} onChange={type => set({ type })} />

        <Field id="account-name" label={t.nameLabel}>
          <TextField
            id="account-name"
            value={form.name}
            placeholder={t.namePlaceholder.value}
            onChange={event => set({ name: event.target.value })}
            fullWidth
            size="small"
          />
        </Field>

        <Field id="account-bank" label={t.bankLabel}>
          <TextField
            id="account-bank"
            value={form.bankName}
            onChange={event => set({ bankName: event.target.value })}
            fullWidth
            size="small"
          />
        </Field>

        <Field id="account-number" label={t.accountNumberLabel} hint={t.accountNumberHint}>
          <TextField
            id="account-number"
            value={form.accountNumber}
            onChange={event => set({ accountNumber: event.target.value })}
            fullWidth
            size="small"
          />
        </Field>

        {/* Picked from the currency drawer, as on payables and goals: a typed code could be anything. */}
        <Field id="account-currency" label={t.currencyLabel}>
          <TextField
            id="account-currency"
            value={picker.selectedCurrencyItem ? picker.selectedCurrencyItem.label : form.currency}
            onClick={openCurrency}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openCurrency();
              }
            }}
            fullWidth
            size="small"
            slotProps={{
              htmlInput: {
                readOnly: true,
                'aria-haspopup': 'dialog',
                style: { cursor: 'pointer' },
              },
            }}
          />
        </Field>

        <Field
          id="account-opening"
          label={debt ? t.owedLabel : t.openingLabel}
          hint={debt ? undefined : t.openingHint}
        >
          <TextField
            id="account-opening"
            value={form.openingBalance}
            onChange={event => set({ openingBalance: event.target.value })}
            fullWidth
            size="small"
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Field>

        {members.length > 1 && (
          <Field id="account-owner" label={t.ownerLabel}>
            <Select
              id="account-owner"
              size="small"
              fullWidth
              value={form.ownerMemberId ?? SHARED}
              options={[
                { value: SHARED, label: t.ownerShared.value },
                ...members.map(member => ({ value: member.memberId, label: member.label })),
              ]}
              onChange={value => set({ ownerMemberId: value === SHARED ? null : value })}
            />
          </Field>
        )}
      </AccountSideDrawer>

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
          set({ currency: code });
          picker.pushRecentCurrency(code);
        }}
      />
    </>
  );
}
