'use client';

import Button from '@mui/material/Button';
import Link from 'next/link';
import { useState } from 'react';
import { ImportFromFileButton } from '@/app/components/import-wizard/ImportFromFileButton';
import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { AccountStatement } from '@/app/lib/contracts';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import {
  type Account,
  type useAccountMutations,
  useUnlinkedStatements,
} from '../hooks/useAccounts';
import { cardStyle, listRowStyle, mutedStyle, titleStyle } from './account-detail-styles';
import { LinkStatementsDrawer, statementPeriod } from './LinkStatementsDrawer';

/** A year of monthly statements is a wall; the latest few say enough until asked. */
const STATEMENTS_SHOWN = 5;

/**
 * The statements an account holds, and the two ways to add more: link ones
 * already uploaded (those in its currency, the likely ones first and picked
 * already) or import a bank export straight into it.
 */
export function AccountStatementsCard({
  account,
  statements,
  mutations,
  money,
}: {
  account: Account;
  statements: AccountStatement[];
  mutations: ReturnType<typeof useAccountMutations>;
  /** An amount in the account's currency. */
  money: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const unlinked = useUnlinkedStatements();
  const [showAll, setShowAll] = useState(false);
  const [linking, setLinking] = useState(false);

  const candidates = unlinked
    .filter(statement => statement.currency.toUpperCase() === account.currency.toUpperCase())
    .map(statement => ({
      ...statement,
      suggestedWalletId: statement.suggestedWalletId === account.id ? account.id : null,
    }))
    .sort((a, b) => Number(Boolean(b.suggestedWalletId)) - Number(Boolean(a.suggestedWalletId)));

  const link = async (byAccount: Map<string, string[]>) => {
    if (await mutations.attach(account.id, byAccount.get(account.id) ?? [])) {
      setLinking(false);
    }
  };

  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ ...titleStyle, flex: 1 }}>{t.statementsTitle}</h2>
        {candidates.length > 0 && (
          <ReadOnlyHint>
            <Button size="small" variant="text" onClick={() => setLinking(true)}>
              {t.linkStatements}
            </Button>
          </ReadOnlyHint>
        )}
        <ImportFromFileButton
          target="transactions"
          account={{ id: account.id, currency: account.currency }}
          onImported={() => invalidateFinancialData()}
          renderTrigger={(open, label) => (
            <ReadOnlyHint>
              <Button size="small" variant="text" onClick={open}>
                {label}
              </Button>
            </ReadOnlyHint>
          )}
        />
      </div>

      {statements.length === 0 ? (
        <span style={mutedStyle}>{t.noStatements}</span>
      ) : (
        <div>
          {(showAll ? statements : statements.slice(0, STATEMENTS_SHOWN)).map(statement => (
            <div key={statement.id} style={listRowStyle}>
              <Link
                href={`/statements/${statement.id}/edit`}
                style={{ display: 'grid', gap: 2, textDecoration: 'none', minWidth: 0 }}
              >
                <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                  {statementPeriod(statement, locale) || statement.fileName}
                </span>
                <span style={mutedStyle}>
                  {statement.balanceEnd === null
                    ? statement.fileName
                    : fillTemplateNodes(t.closingBalance.value, {
                        amount: money(statement.balanceEnd),
                      })}
                </span>
              </Link>
              <ReadOnlyHint>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => void mutations.detach(account.id, statement.id)}
                >
                  {t.unlink}
                </Button>
              </ReadOnlyHint>
            </div>
          ))}
          {statements.length > STATEMENTS_SHOWN && !showAll && (
            <Button variant="text" onClick={() => setShowAll(true)}>
              {t.showAllStatements.value.replace('{{count}}', String(statements.length))}
            </Button>
          )}
        </div>
      )}

      <LinkStatementsDrawer
        open={linking}
        statements={candidates}
        accounts={[account]}
        saving={mutations.saving}
        onClose={() => setLinking(false)}
        onLink={byAccount => void link(byAccount)}
      />
    </section>
  );
}
