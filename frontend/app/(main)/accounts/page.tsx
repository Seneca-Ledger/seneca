'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { useState } from 'react';
import { Plus } from '@/app/components/icons';
import { useQuickActions } from '@/app/components/mobile/quick-actions-store';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { CoinsLineIcon } from '@/app/components/ui/empty-state-icons';
import { LoadError } from '@/app/components/ui/load-error';
import { PageTitle } from '@/app/components/ui/page-title';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';
import {
  ACCOUNT_GROUPS,
  type AccountGroup,
  accountGroupOf,
  maskedAccountNumber,
} from './account-types';
import { AccountFormDrawer } from './components/AccountFormDrawer';
import { AccountRow } from './components/AccountRow';
import {
  type FoundAccount,
  FoundStatements,
  findAccounts,
  openingBalanceOf,
} from './components/FoundStatements';
import { LinkStatementsDrawer } from './components/LinkStatementsDrawer';
import { useAccountLabels } from './components/use-account-labels';
import {
  type Account,
  type AccountForm,
  emptyAccountForm,
  useAccountMutations,
  useAccounts,
} from './hooks/useAccounts';

const cardStyle = {
  border: '1px solid var(--border)',
  borderRadius: tokens.radius.md,
  background: 'var(--card)',
  padding: 4,
  display: 'grid',
} as const;

function RowSkeleton(): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.75 }}>
      <Skeleton variant="circular" width={36} height={36} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width={140} height={20} />
        <Skeleton variant="text" width={90} height={16} />
      </Box>
      <Skeleton variant="text" width={90} height={20} />
    </Box>
  );
}

/** "On accounts €12,340 · Owed €1,200": one calm line instead of a row of KPI cards. */
function Summary({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof useAccounts>['summary']>;
}): React.JSX.Element {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const money = (value: number) =>
    formatMoney(value, summary.currency, locale, { fractionDigits: 0 });
  const figure = {
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--foreground)',
  };
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 15 }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {t.summaryAssets}{' '}
          <PrivateAmount>
            <span style={figure}>{money(summary.assets)}</span>
          </PrivateAmount>
        </span>
        {summary.debts > 0 && (
          <span style={{ color: 'var(--text-muted)' }}>
            {t.summaryDebts}{' '}
            <PrivateAmount>
              <span style={figure}>{money(summary.debts)}</span>
            </PrivateAmount>
          </span>
        )}
      </div>
      {summary.unconverted.length > 0 && (
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t.unconvertedNote.value.replace(
            '{{list}}',
            summary.unconverted.map(entry => entry.currency).join(', '),
          )}
        </span>
      )}
    </div>
  );
}

export default function AccountsPage() {
  const t = useIntlayer('accountsPage');
  const { groups } = useAccountLabels();
  const { accounts, summary, unlinked, isPending, isFetching, error } = useAccounts();
  const mutations = useAccountMutations(t.failed.value);

  const [formOpen, setFormOpen] = useState(false);
  const [initialForm, setInitialForm] = useState<AccountForm>(() => emptyAccountForm(''));
  const [linkOpen, setLinkOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const workspaceCurrency = summary?.currency ?? '';
  const openCreate = () => {
    setInitialForm(emptyAccountForm(workspaceCurrency));
    setFormOpen(true);
  };
  useQuickActions([{ id: 'new-account', label: t.addAccount.value, icon: Plus, run: openCreate }]);

  const openFromFound = (found: FoundAccount) => {
    const masked = maskedAccountNumber(found.accountNumber) ?? found.accountNumber;
    const opening = openingBalanceOf(found.statements);
    setInitialForm({
      ...emptyAccountForm(found.currency),
      name: found.bank
        ? `${found.bank} ${masked}`
        : t.accountWithNumber.value.replace('{{number}}', masked),
      bankName: found.bank ?? '',
      accountNumber: found.accountNumber,
      openingBalance: opening === null ? '' : String(opening),
      statementIds: found.statements.map(statement => statement.id),
    });
    setFormOpen(true);
  };

  const save = async (form: AccountForm) => {
    if (await mutations.create(form)) {
      setFormOpen(false);
    }
  };

  const link = async (byAccount: Map<string, string[]>) => {
    for (const [accountId, statementIds] of byAccount) {
      if (!(await mutations.attach(accountId, statementIds))) {
        return;
      }
    }
    setLinkOpen(false);
  };

  const active = accounts.filter(account => account.isActive);
  const archived = accounts.filter(account => !account.isActive);
  const byGroup = new Map<AccountGroup, Account[]>();
  for (const account of active) {
    const group = accountGroupOf(account.type);
    byGroup.set(group, [...(byGroup.get(group) ?? []), account]);
  }
  const found = findAccounts(unlinked);
  // Statements of a found account are offered there (create it); sorting is for
  // the rest: those an existing account would take, and those with no number.
  const inFound = new Set(found.flatMap(account => account.statements.map(item => item.id)));
  const toSort = unlinked.filter(statement => !inFound.has(statement.id));
  const noAccounts = !(isPending || error) && accounts.length === 0;

  return (
    <Box
      component="main"
      sx={{
        px: { xs: 2, md: 4 },
        pt: 'var(--seneca-page-top, 24px)',
        pb: 3,
        width: '100%',
        display: 'grid',
        gap: 3,
        alignContent: 'start',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
        <PageTitle path="/accounts" />
        {noAccounts ? null : (
          <ReadOnlyHint>
            <Button variant="contained" className="seneca-bottom-bar-source" onClick={openCreate}>
              <Plus size={18} aria-hidden />
              {t.addAccount}
            </Button>
          </ReadOnlyHint>
        )}
      </Box>

      {summary && active.length > 0 && <Summary summary={summary} />}

      <FoundStatements
        found={found}
        unlinkedCount={accounts.length > 0 ? toSort.length : 0}
        onCreate={openFromFound}
        onSort={() => setLinkOpen(true)}
      />

      {isPending && (
        <div style={cardStyle}>
          {Array.from({ length: 3 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <RowSkeleton key={index} />
          ))}
        </div>
      )}

      {error && !isPending && <LoadError spacing={6}>{t.loadError}</LoadError>}

      {noAccounts && (
        <EmptyState
          // Alone on the page it sits in the middle; under the found accounts it follows them.
          fill={found.length === 0}
          icon={<CoinsLineIcon />}
          title={t.emptyTitle}
          description={t.emptyHint}
          action={
            <ReadOnlyHint>
              <Button variant="contained" onClick={openCreate}>
                {t.addAccount}
              </Button>
            </ReadOnlyHint>
          }
        />
      )}

      <div
        style={{
          display: 'grid',
          gap: 24,
          opacity: isFetching && !isPending ? 0.6 : 1,
          transition: 'opacity 150ms ease',
        }}
      >
        {ACCOUNT_GROUPS.filter(group => byGroup.has(group)).map(group => (
          <section key={group} style={{ display: 'grid', gap: 8 }} aria-label={groups[group]}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 4 }}>
              {groups[group]}
            </span>
            <div style={cardStyle}>
              {byGroup.get(group)?.map(account => (
                <AccountRow key={account.id} account={account} />
              ))}
            </div>
          </section>
        ))}

        {archived.length > 0 && (
          <section style={{ display: 'grid', gap: 8 }}>
            <Button
              variant="text"
              onClick={() => setShowArchived(value => !value)}
              aria-expanded={showArchived}
              sx={{ justifySelf: 'start', color: 'var(--text-muted)' }}
            >
              {t.archivedSection.value.replace('{{count}}', String(archived.length))}
            </Button>
            {showArchived && (
              <div style={cardStyle}>
                {archived.map(account => (
                  <AccountRow key={account.id} account={account} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <AccountFormDrawer
        open={formOpen}
        editing={false}
        initial={initialForm}
        saving={mutations.saving}
        onClose={() => setFormOpen(false)}
        onSave={form => void save(form)}
      />

      <LinkStatementsDrawer
        open={linkOpen}
        statements={toSort}
        accounts={accounts}
        saving={mutations.saving}
        onClose={() => setLinkOpen(false)}
        onLink={byAccount => void link(byAccount)}
      />
    </Box>
  );
}
