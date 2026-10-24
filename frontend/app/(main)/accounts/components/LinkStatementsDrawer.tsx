'use client';

import Button from '@mui/material/Button';
import { useEffect, useState } from 'react';
import { Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { AccountStatement } from '@/app/lib/contracts';
import type { Account } from '../hooks/useAccounts';
import { AccountSideDrawer } from './AccountSideDrawer';

const NOT_NOW = '';

export function statementPeriod(statement: AccountStatement, locale: string): string {
  const format = (date: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(date),
    );
  if (statement.dateFrom && statement.dateTo) {
    return `${format(statement.dateFrom)} – ${format(statement.dateTo)}`;
  }
  return statement.dateTo ? format(statement.dateTo) : '';
}

/**
 * Every statement no account holds, each with a picker of the accounts in its
 * currency. The account a number points to is chosen already; the person only
 * confirms, or picks another.
 */
export function LinkStatementsDrawer({
  open,
  statements,
  accounts,
  saving,
  onClose,
  onLink,
}: {
  open: boolean;
  statements: AccountStatement[];
  accounts: Account[];
  saving: boolean;
  onClose: () => void;
  /** Statement ids per account id. */
  onLink: (byAccount: Map<string, string[]>) => void;
}): React.JSX.Element {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const [choice, setChoice] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setChoice(
        Object.fromEntries(statements.map(item => [item.id, item.suggestedWalletId ?? NOT_NOW])),
      );
    }
  }, [open, statements]);

  const byAccount = new Map<string, string[]>();
  for (const [statementId, accountId] of Object.entries(choice)) {
    if (accountId !== NOT_NOW) {
      byAccount.set(accountId, [...(byAccount.get(accountId) ?? []), statementId]);
    }
  }
  const active = accounts.filter(account => account.isActive);

  return (
    <AccountSideDrawer
      open={open}
      title={t.linkDrawerTitle.value}
      backLabel={t.cancel.value}
      onClose={onClose}
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={saving} sx={{ marginLeft: 'auto' }}>
            {t.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={() => onLink(byAccount)}
            disabled={saving || byAccount.size === 0}
          >
            {t.linkSave}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{t.linkHint}</p>
      {statements.map(statement => {
        const options = active.filter(account => account.currency === statement.currency);
        return (
          <div key={statement.id} style={{ display: 'grid', gap: 6 }}>
            <span style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
                {statement.fileName}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {[statementPeriod(statement, locale), statement.currency]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            {options.length > 0 ? (
              <Select
                size="small"
                fullWidth
                aria-label={statement.fileName}
                value={choice[statement.id] ?? NOT_NOW}
                options={[
                  { value: NOT_NOW, label: t.noAccountOption.value },
                  ...options.map(account => ({ value: account.id, label: account.name })),
                ]}
                onChange={value => setChoice(prev => ({ ...prev, [statement.id]: value }))}
              />
            ) : (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {t.noAccountInCurrency.value.replace('{{currency}}', statement.currency)}
              </span>
            )}
          </div>
        );
      })}
    </AccountSideDrawer>
  );
}
