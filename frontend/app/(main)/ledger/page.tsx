'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { Suspense } from 'react';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { AccountCardTab } from './components/AccountCardTab';
import { AccountsTab } from './components/AccountsTab';
import { EnableLedger } from './components/EnableLedger';
import { JournalTab } from './components/JournalTab';
import { LedgerFreshness } from './components/LedgerFreshness';
import { TrialBalanceTab } from './components/TrialBalanceTab';
import {
  useLedgerAccounts,
  useLedgerIntegrity,
  useLedgerMutations,
  useLedgerSettings,
} from './hooks/useLedger';
import { canWriteLedger, LEDGER_TABS, type LedgerTab, parseTab } from './ledger.helpers';

function Loading(): React.ReactElement {
  return (
    <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
      <CircularProgress size={28} />
    </Box>
  );
}

/** System accounts are shown in the UI language, keyed by their fixed code. */
function useSystemAccountNames(): Record<string, string> {
  const t = useIntlayer('ledgerPage');
  return {
    ASSETS: t.accAssets.value,
    ASSET_CASH: t.accCash.value,
    ASSET_CASH_UNALLOCATED: t.accCashUnallocated.value,
    ASSET_VAT_RECEIVABLE: t.accVatReceivable.value,
    ASSET_SUSPENSE: t.accSuspense.value,
    ASSET_CRYPTO: t.accCrypto.value,
    LIABILITIES: t.accLiabilities.value,
    LIABILITY_VAT_PAYABLE: t.accVatPayable.value,
    LIABILITY_PAYABLES: t.accPayables.value,
    EQUITY: t.accEquity.value,
    EQUITY_OPENING_BALANCE: t.accOpeningBalance.value,
    EQUITY_RETAINED_EARNINGS: t.accRetainedEarnings.value,
    INCOME: t.accIncome.value,
    INCOME_FX_GAIN: t.accFxGain.value,
    EXPENSES: t.accExpenses.value,
    EXPENSE_FX_LOSS: t.accFxLoss.value,
  };
}

function LedgerContent(): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission } = usePermissions();
  const systemNames = useSystemAccountNames();

  // Tab and account live in the URL so a reload or a shared link lands on the same view.
  const tab = parseTab(searchParams.get('tab'));
  const accountId = searchParams.get('account');
  const updateQuery = (patch: Record<string, string>): void => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const { currentWorkspace } = useWorkspace();
  const role = currentWorkspace?.memberRole;
  const canManage = canWriteLedger(hasPermission('ledger.manage_accounts'), role);
  const canPost = canWriteLedger(hasPermission('ledger.post'), role);

  const settings = useLedgerSettings();
  const enabled = settings.data?.enabled === true;
  const integrity = useLedgerIntegrity(enabled);
  const accounts = useLedgerAccounts(enabled);
  const mutations = useLedgerMutations();

  const tabLabels: Record<LedgerTab, React.ReactNode> = {
    accounts: t.tabAccounts,
    journal: t.tabJournal,
    'trial-balance': t.tabTrialBalance,
    account: t.tabAccount,
  };
  const openAccount = (id: string): void => updateQuery({ tab: 'account', account: id });

  const renderTab = (): React.ReactNode => {
    if (accounts.isError) {
      return <Alert severity="error">{t.loadError}</Alert>;
    }
    if (!(accounts.data && settings.data?.baseCurrency)) {
      return <Loading />;
    }
    switch (tab) {
      case 'accounts':
        return (
          <AccountsTab
            accounts={accounts.data}
            integrity={integrity.data}
            systemNames={systemNames}
            canManage={canManage}
            creating={mutations.createAccount.isPending}
            onCreate={input => mutations.createAccount.mutateAsync(input)}
            onDelete={id => mutations.deleteAccount.mutateAsync(id)}
            onOpenAccount={openAccount}
          />
        );
      case 'trial-balance':
        return <TrialBalanceTab systemNames={systemNames} onOpenAccount={openAccount} />;
      case 'account':
        return (
          <AccountCardTab
            accounts={accounts.data}
            systemNames={systemNames}
            accountId={accountId}
            onChangeAccount={id => updateQuery({ account: id })}
          />
        );
      default:
        return (
          <JournalTab
            baseCurrency={settings.data.baseCurrency}
            accounts={accounts.data}
            systemNames={systemNames}
            canPost={canPost}
          />
        );
    }
  };

  const renderBody = (): React.ReactNode => {
    if (settings.isError) {
      return <Alert severity="error">{t.loadError}</Alert>;
    }
    if (!settings.data) {
      return <Loading />;
    }
    if (!enabled) {
      return (
        <EnableLedger
          settings={settings.data}
          canManage={canManage}
          saving={mutations.enable.isPending}
          error={mutations.enable.isError ? getApiErrorMessage(mutations.enable.error) : null}
          onEnable={currency => mutations.enable.mutate(currency)}
        />
      );
    }
    return (
      <>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Tabs
            value={tab}
            // eslint-disable-next-line max-params
            onChange={(_event, value: LedgerTab) => updateQuery({ tab: value })}
            variant="scrollable"
            scrollButtons={false}
            sx={sharedMuiTabsSx}
          >
            {LEDGER_TABS.map(key => (
              <Tab key={key} value={key} label={tabLabels[key]} />
            ))}
          </Tabs>
          {settings.data.baseCurrency ? (
            <Chip
              sx={{ ml: 'auto', flexShrink: 0 }}
              label={`${t.baseCurrencyLabel.value}: ${settings.data.baseCurrency}`}
            />
          ) : null}
        </Box>
        {integrity.data ? <LedgerFreshness integrity={integrity.data} /> : null}
        <Box sx={{ mt: 2 }}>{renderTab()}</Box>
      </>
    );
  };

  return (
    <Box
      component="main"
      sx={{
        px: { xs: 2, md: 4 },
        pt: 'var(--lumio-page-top, 24px)',
        pb: 3,
        width: '100%',
      }}
    >
      {renderBody()}
    </Box>
  );
}

export default function LedgerPage(): React.ReactElement {
  // useSearchParams needs a Suspense boundary for the static render of the route.
  return (
    <Suspense fallback={<Loading />}>
      <LedgerContent />
    </Suspense>
  );
}
