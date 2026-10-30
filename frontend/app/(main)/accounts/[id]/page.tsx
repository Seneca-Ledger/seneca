'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LazyNetWorthArea } from '@/app/components/charts/lazy-charts';
import { ArrowLeft } from '@/app/components/icons';
import { LoadError } from '@/app/components/ui/load-error';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { accountSubtitle } from '../account-types';
import { AccountDetailSkeleton } from '../components/AccountDetailSkeleton';
import { AccountFormDrawer } from '../components/AccountFormDrawer';
import { AccountReconciliation } from '../components/AccountReconciliation';
import { AccountBadge, AccountBalance } from '../components/AccountRow';
import { AccountStatementsCard } from '../components/AccountStatementsCard';
import { AccountTransactionsCard } from '../components/AccountTransactionsCard';
import { cardStyle, mutedStyle, titleStyle } from '../components/account-detail-styles';
import { useAccountLabels } from '../components/use-account-labels';
import {
  type AccountForm,
  accountToForm,
  useAccount,
  useAccountMutations,
} from '../hooks/useAccounts';

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

      {isPending && <AccountDetailSkeleton />}

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

          <AccountStatementsCard
            account={account}
            statements={statements}
            mutations={mutations}
            money={money}
          />

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
