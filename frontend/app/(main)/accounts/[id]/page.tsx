'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LazyNetWorthArea } from '@/app/components/charts/lazy-charts';
import { ArrowLeft } from '@/app/components/icons';
import { LoadError } from '@/app/components/ui/load-error';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { accountSubtitle } from '../account-types';
import { AccountFormDrawer } from '../components/AccountFormDrawer';
import { AccountReconciliation } from '../components/AccountReconciliation';
import { AccountBadge, AccountBalance } from '../components/AccountRow';
import { AccountTransactionsCard } from '../components/AccountTransactionsCard';
import {
  cardStyle,
  listRowStyle,
  mutedStyle,
  titleStyle,
} from '../components/account-detail-styles';
import { statementPeriod } from '../components/LinkStatementsDrawer';
import { useAccountLabels } from '../components/use-account-labels';
import {
  type AccountForm,
  accountToForm,
  useAccount,
  useAccountMutations,
} from '../hooks/useAccounts';

/** A year of monthly statements is a wall; the latest few say enough until asked. */
const STATEMENTS_SHOWN = 5;

export default function AccountPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const t = useIntlayer('accountsPage');
  const nav = useIntlayer('navigation');
  const { types } = useAccountLabels();
  const { locale } = useLocale();
  const { account, series, statements, transactions, isPending, error } = useAccount(id);
  const mutations = useAccountMutations(t.failed.value);

  const [formOpen, setFormOpen] = useState(false);
  const [initialForm, setInitialForm] = useState<AccountForm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAllStatements, setShowAllStatements] = useState(false);

  const openEdit = () => {
    if (account) {
      setInitialForm(accountToForm(account));
      setFormOpen(true);
    }
  };
  const save = async (form: AccountForm) => {
    if (await mutations.update(id, form)) {
      setFormOpen(false);
    }
  };
  const money = (value: number) => formatMoney(value, account?.currency ?? 'EUR', locale);

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
      <Button
        component={Link}
        href="/accounts"
        size="small"
        startIcon={<ArrowLeft size={16} />}
        sx={{ justifySelf: 'start' }}
      >
        {nav.nav.accounts}
      </Button>

      {error && !isPending && <LoadError spacing={6}>{t.notFound}</LoadError>}

      {isPending && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Skeleton variant="text" width={240} height={32} />
          <Skeleton variant="text" width={160} height={40} />
          <Skeleton variant="rounded" height={200} />
        </Box>
      )}

      {account && (
        <>
          <header style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <AccountBadge type={account.type} size={44} />
            <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: 'var(--foreground)' }}>
                {account.name}
              </h1>
              <span style={mutedStyle}>
                {[types[account.type], accountSubtitle(account), account.currency]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <ReadOnlyHint>
              <Button variant="outlined" onClick={openEdit}>
                {t.edit}
              </Button>
            </ReadOnlyHint>
          </header>

          <div style={{ display: 'grid', gap: 6 }}>
            <AccountBalance account={account} size={32} />
            <AccountReconciliation account={account} />
            {!account.isActive && (
              <ReadOnlyHint>
                <Button
                  variant="text"
                  sx={{ justifySelf: 'start' }}
                  onClick={() => void mutations.setActive(account.id, true)}
                >
                  {t.restore}
                </Button>
              </ReadOnlyHint>
            )}
          </div>

          {series.length > 1 && (
            <section style={cardStyle}>
              <h2 style={titleStyle}>{t.balanceTitle}</h2>
              <div className="seneca-chart__box">
                <LazyNetWorthArea
                  points={series.map(point => ({ date: point.date, value: point.balance }))}
                  positive={series[series.length - 1].balance >= series[0].balance}
                  locale={locale}
                  formatValue={money}
                />
              </div>
            </section>
          )}

          <section style={cardStyle}>
            <h2 style={titleStyle}>{t.statementsTitle}</h2>
            {statements.length === 0 ? (
              <span style={mutedStyle}>{t.noStatements}</span>
            ) : (
              <div>
                {(showAllStatements ? statements : statements.slice(0, STATEMENTS_SHOWN)).map(
                  statement => (
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
                  ),
                )}
                {statements.length > STATEMENTS_SHOWN && !showAllStatements && (
                  <Button variant="text" onClick={() => setShowAllStatements(true)}>
                    {t.showAllStatements.value.replace('{{count}}', String(statements.length))}
                  </Button>
                )}
              </div>
            )}
          </section>

          <AccountTransactionsCard transactions={transactions} money={money} />

          {initialForm && (
            <AccountFormDrawer
              open={formOpen}
              editing
              initial={initialForm}
              saving={mutations.saving}
              onClose={() => setFormOpen(false)}
              onSave={form => void save(form)}
              onArchive={() =>
                void mutations.setActive(account.id, false).then(ok => ok && setFormOpen(false))
              }
              onDelete={() => {
                setFormOpen(false);
                setDeleting(true);
              }}
            />
          )}

          <ModalShell
            isOpen={deleting}
            onClose={() => setDeleting(false)}
            title={t.deleteTitle}
            size="sm"
            footer={
              <ModalFooter
                onCancel={() => setDeleting(false)}
                onConfirm={() =>
                  void mutations.remove(account.id).then(ok => ok && router.push('/accounts'))
                }
                cancelText={t.cancel.value}
                confirmText={t.delete.value}
                confirmVariant="destructive"
                isConfirmLoading={mutations.saving}
              />
            }
          >
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
              {t.deleteBody.value.replace('{{count}}', String(account.transactionCount))}
            </p>
          </ModalShell>
        </>
      )}
    </Box>
  );
}
