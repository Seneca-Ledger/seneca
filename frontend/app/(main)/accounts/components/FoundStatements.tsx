'use client';

import Button from '@mui/material/Button';
import { useIntlayer } from '@/app/i18n';
import type { AccountStatement } from '@/app/lib/contracts';
import { tokens } from '@/lib/theme-tokens';
import { maskedAccountNumber, statementBankLabel } from '../account-types';

/** Statements with one account number and currency that no account carries yet. */
export interface FoundAccount {
  key: string;
  accountNumber: string;
  currency: string;
  bank: string | null;
  statements: AccountStatement[];
}

/**
 * Groups the unheld statements an existing account would not take by number:
 * each group is an account the person has and the app does not know yet.
 */
export function findAccounts(unlinked: AccountStatement[]): FoundAccount[] {
  const groups = new Map<string, FoundAccount>();
  for (const statement of unlinked) {
    if (statement.suggestedWalletId || !statement.accountNumber) {
      continue;
    }
    const key = `${statement.accountNumber.replace(/\s+/g, '')}|${statement.currency}`;
    const group = groups.get(key) ?? {
      key,
      accountNumber: statement.accountNumber,
      currency: statement.currency,
      bank: statementBankLabel(statement.bankName),
      statements: [],
    };
    group.statements.push(statement);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** The opening balance that makes the account agree with the bank: the earliest statement's start. */
export function openingBalanceOf(statements: AccountStatement[]): number | null {
  const dated = statements
    .filter(statement => statement.balanceStart !== null)
    .sort((left, right) => (left.dateFrom ?? '').localeCompare(right.dateFrom ?? ''));
  return dated[0]?.balanceStart ?? null;
}

const panelStyle = {
  display: 'grid',
  gap: 4,
  padding: '12px 16px',
  borderRadius: tokens.radius.md,
  background: 'var(--surface-soft)',
} as const;

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  padding: '6px 0',
} as const;

export function FoundStatements({
  found,
  unlinkedCount,
  onCreate,
  onSort,
}: {
  found: FoundAccount[];
  unlinkedCount: number;
  onCreate: (account: FoundAccount) => void;
  onSort: () => void;
}): React.JSX.Element | null {
  const t = useIntlayer('accountsPage');
  if (found.length === 0 && unlinkedCount === 0) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {found.length > 0 && (
        <section style={panelStyle} aria-label={t.foundTitle.value}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>
            {t.foundTitle}
          </span>
          {found.map(account => (
            <div key={account.key} style={rowStyle}>
              <span style={{ display: 'grid', gap: 2 }}>
                <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                  {[account.bank, maskedAccountNumber(account.accountNumber), account.currency]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {t.statementCount.value.replace('{{count}}', String(account.statements.length))}
                </span>
              </span>
              <Button size="small" variant="outlined" onClick={() => onCreate(account)}>
                {t.createFromFound}
              </Button>
            </div>
          ))}
        </section>
      )}

      {unlinkedCount > 0 && (
        <div style={{ ...panelStyle, ...rowStyle, padding: '10px 16px' }}>
          <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
            {t.unlinkedTitle.value.replace('{{count}}', String(unlinkedCount))}
          </span>
          <Button size="small" variant="text" onClick={onSort}>
            {t.unlinkedAction}
          </Button>
        </div>
      )}
    </div>
  );
}
