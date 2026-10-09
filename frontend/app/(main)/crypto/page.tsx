'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type React from 'react';
import { useState } from 'react';
import { RefreshCcw } from '@/app/components/icons';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { AllocationCard } from './components/AllocationCard';
import { ConnectedWalletsCard } from './components/ConnectedWalletsCard';
import { ConnectWalletDrawer } from './components/ConnectWalletDrawer';
import { CryptoTransactionsTable } from './components/CryptoTransactionsTable';
import { ExchangeImportButton } from './components/ExchangeImportButton';
import { GainsCard } from './components/GainsCard';
import { HoldingsTable } from './components/HoldingsTable';
import { ManualHoldingsCard } from './components/ManualHoldingsCard';
import { PortfolioSummary } from './components/PortfolioSummary';
import { useCrypto } from './hooks/useCrypto';

export default function CryptoPage(): React.JSX.Element {
  const t = useIntlayer('cryptoPage');
  const { locale } = useLocale();
  const {
    wallets,
    summary,
    transactions,
    networks,
    isPending,
    error,
    refetch,
    busyWalletId,
    connecting,
    connectWallet,
    syncWallet,
    removeWallet,
    history,
    savingHolding,
    saveHolding,
    removeHolding,
    importing,
    importExchangeCsv,
    gains,
    gainsYear,
    setGainsYear,
  } = useCrypto();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const currency = summary?.currency ?? 'USD';
  const money = (value: number): string => formatMoney(value, currency, locale);

  // A duplicate address belongs next to the field the user must change; every
  // other failure is a page-level problem and is reported above the list.
  const hasData = wallets.length > 0 || summary !== null;

  const drawerServerError = error === 'duplicate' ? t.duplicate.value : null;

  const manualWallet = wallets.find(wallet => wallet.kind === 'manual') ?? null;
  // Addresses and exchange accounts are both wallets with a card; the hand-kept
  // lines have their own card, where they can be edited.
  const onChainWallets = wallets.filter(wallet => wallet.kind !== 'manual');
  const manualBalances = manualWallet?.balances ?? [];
  // The years that actually have sales, newest first; a year with none is not
  // worth offering.
  const gainYears = [
    ...new Set((gains?.disposals ?? []).map(disposal => Number(disposal.date.slice(0, 4)))),
  ].sort((a, b) => b - a);

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--lumio-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: { xs: 'stretch', sm: 'flex-end' },
          alignItems: 'center',
          gap: 1.5,
          mb: 3,
          flexWrap: 'wrap',
          // On a phone the two actions share a row instead of stacking ragged
          // against the right edge.
          '& > *': { flex: { xs: '1 1 45%', sm: '0 0 auto' } },
        }}
      >
        <ExchangeImportButton
          importing={importing}
          labels={{
            button: t.importExchange.value,
            hint: t.importHint.value,
            failed: t.importFailed.value,
            done: t.importDone.value,
          }}
          onImport={importExchangeCsv}
        />
        <Button variant="contained" onClick={() => setDrawerOpen(true)}>
          {t.connect}
        </Button>
      </Box>

      {isPending && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <Spinner size={32} />
        </Box>
      )}

      {/* Nothing to show at all: the illustrated state replaces the page. With data
          already on screen (a failed sync), a slim alert keeps that data visible. */}
      {error === 'failed' && !isPending && !hasData && (
        <EmptyState
          illustration="load-error"
          size="lg"
          title={t.error}
          description={t.errorHint}
          action={
            <Button variant="outlined" startIcon={<RefreshCcw size={16} />} onClick={refetch}>
              {t.retry}
            </Button>
          }
        />
      )}

      {error === 'failed' && !isPending && hasData && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ mb: 3, alignItems: 'center' }}
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              {t.retry}
            </Button>
          }
        >
          {t.error}
        </Alert>
      )}

      {!isPending && wallets.length === 0 && error !== 'failed' && (
        <EmptyState illustration="integrations" description={t.empty} />
      )}

      {!isPending && wallets.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {summary && (
            <PortfolioSummary
              summary={summary}
              history={history}
              locale={locale}
              money={money}
              labels={{
                sinceYesterday: t.sinceYesterday.value,
                historyEmpty: t.historyEmpty.value,
                unrealized: t.unrealized.value,
                costBasis: t.costBasis.value,
                income: t.income.value,
                expense: t.expense.value,
              }}
            />
          )}

          {summary && summary.holdings.length > 0 && (
            <HoldingsTable
              holdings={summary.holdings}
              locale={locale}
              money={money}
              labels={{
                title: t.holdings.value,
                asset: t.asset.value,
                balance: t.balance.value,
                price: t.price.value,
                worth: t.worth.value,
                avgCost: t.avgCost.value,
                unrealized: t.unrealized.value,
                basisUnknown: t.basisUnknown.value,
              }}
            />
          )}

          {/* Two columns, not three: the wallets are a list that grows, the other
              two are short cards, and pairing them keeps both sides the same
              height instead of leaving a hole under the shorter one. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {summary && summary.holdings.length > 0 && (
                <AllocationCard
                  holdings={summary.holdings}
                  money={money}
                  title={t.allocation.value}
                />
              )}

              <ManualHoldingsCard
                wallet={manualWallet}
                balances={manualBalances}
                saving={savingHolding}
                labels={{
                  title: t.manualHoldings.value,
                  add: t.addHolding.value,
                  ticker: t.tickerLabel.value,
                  amount: t.amount.value,
                  costPerUnit: t.costPerUnit.value,
                  save: t.save.value,
                  cancel: t.cancel.value,
                  remove: t.remove.value,
                }}
                onSave={saveHolding}
                onRemove={removeHolding}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <ConnectedWalletsCard
                wallets={onChainWallets}
                locale={locale}
                busyWalletId={busyWalletId}
                labels={{
                  title: t.connectedWallets.value,
                  sync: t.sync.value,
                  remove: t.remove.value,
                  transactions: t.transactions.value,
                  neverSynced: t.neverSynced.value,
                }}
                onSync={id => syncWallet(id)}
                onRemove={id => removeWallet(id)}
              />
            </Box>
          </Box>

          {summary && summary.unpriced.length > 0 && (
            <Alert severity="info" variant="outlined">
              <strong>{t.unpriced}</strong>{' '}
              {summary.unpriced.map(item => `${item.amount} ${item.asset}`).join(', ')} —{' '}
              {t.unpricedHint}
            </Alert>
          )}

          {gains && (
            <GainsCard
              gains={gains}
              year={gainsYear}
              years={gainYears.length > 0 ? gainYears : [new Date().getFullYear()]}
              locale={locale}
              money={money}
              onYearChange={setGainsYear}
              labels={{
                title: t.gains.value,
                hint: t.gainsHint.value,
                empty: t.gainsEmpty.value,
                allYears: t.allYears.value,
                asset: t.asset.value,
                sold: t.soldOn.value,
                acquired: t.acquiredOn.value,
                amount: t.amount.value,
                proceeds: t.proceeds.value,
                cost: t.costBasis.value,
                gain: t.realized.value,
                heldDays: t.heldDays.value,
                exportCsv: t.exportCsv.value,
                basisIncomplete: t.basisIncomplete.value,
                basisIncompleteHint: t.basisIncompleteHint.value,
              }}
            />
          )}

          <CryptoTransactionsTable
            transactions={transactions}
            locale={locale}
            labels={{
              title: t.recentTransactions.value,
              empty: t.noTransactions.value,
              date: t.date.value,
              wallet: t.wallet.value,
              counterparty: t.counterparty.value,
              amount: t.amount.value,
              worth: t.worth.value,
              received: t.received.value,
              sent: t.sent.value,
            }}
          />
        </Box>
      )}

      <ConnectWalletDrawer
        open={drawerOpen}
        saving={connecting}
        serverError={drawerServerError}
        labels={{
          title: t.connect.value,
          walletsLabel: t.walletsLabel.value,
          install: t.install.value,
          manualHint: t.manualHint.value,
          addressLabel: t.addressLabel.value,
          nameLabel: t.nameLabel.value,
          invalidAddress: t.invalidAddress.value,
          networksHint: t.networksHint.value,
          networksLabel: t.networksLabel.value,
          networkDetected: t.networkDetected.value,
          noNetworkSelected: t.noNetworkSelected.value,
          noWallet: t.noWallet.value,
          readOnly: t.readOnly.value,
          connect: t.connect.value,
          cancel: t.cancel.value,
        }}
        onClose={() => setDrawerOpen(false)}
        networks={networks}
        onSubmit={connectWallet}
      />
    </Box>
  );
}
