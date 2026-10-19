'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type React from 'react';
import { useState } from 'react';
import { Plus, RefreshCcw } from '@/app/components/icons';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { ActivityCard } from './components/ActivityCard';
import { ConnectedWalletsCard } from './components/ConnectedWalletsCard';
import { ConnectWalletDrawer } from './components/ConnectWalletDrawer';
import { ExchangeImportButton } from './components/ExchangeImportButton';
import { HoldingsTable } from './components/HoldingsTable';
import { ManualHoldingsDialog } from './components/ManualHoldingsCard';
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
    historyDays,
    setHistoryDays,
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
  const [holdingsOpen, setHoldingsOpen] = useState(false);

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
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <Box
        data-tour-shot="crypto-actions"
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
        <Button
          variant="contained"
          onClick={() => setDrawerOpen(true)}
          data-tour-shot="crypto-connect"
        >
          <Plus size={18} aria-hidden />
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
              historyDays={historyDays}
              onHistoryDaysChange={setHistoryDays}
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

          {/* Holdings, and the wallets beside them as a narrow reference column:
              Allocation repeated Holdings (it is the Share column now), and the
              hand-kept coins are a dialog opened from Holdings' header. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            {summary && summary.holdings.length > 0 ? (
              <HoldingsTable
                holdings={summary.holdings}
                locale={locale}
                currency={currency}
                money={money}
                onAddHolding={() => setHoldingsOpen(true)}
                labels={{
                  title: t.holdings.value,
                  asset: t.asset.value,
                  balance: t.balance.value,
                  price: t.price.value,
                  worth: t.worth.value,
                  avgCost: t.avgCost.value,
                  unrealized: t.unrealized.value,
                  basisUnknown: t.basisUnknown.value,
                  share: t.share.value,
                  addHolding: t.addHolding.value,
                }}
              />
            ) : (
              <Box>
                <Button variant="text" onClick={() => setHoldingsOpen(true)}>
                  <Plus size={16} aria-hidden />
                  {t.addHolding}
                </Button>
              </Box>
            )}

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
                walletOfChain: t.walletOfChain.value,
                copyAddress: t.copyAddress.value,
                copied: t.addressCopied.value,
                syncedToday: t.syncedToday.value,
                syncedOn: t.syncedOn.value,
                moreActions: t.moreActions.value,
                removeConfirm: t.removeWalletConfirm.value,
                cancel: t.cancel.value,
              }}
              onSync={id => syncWallet(id)}
              onRemove={id => removeWallet(id)}
            />
          </Box>

          <ManualHoldingsDialog
            open={holdingsOpen}
            onClose={() => setHoldingsOpen(false)}
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

          {summary && summary.unpriced.length > 0 && (
            <Alert severity="info" variant="outlined">
              <strong>{t.unpriced}</strong>{' '}
              {summary.unpriced.map(item => `${item.amount} ${item.asset}`).join(', ')} —{' '}
              {t.unpricedHint}
            </Alert>
          )}

          {/* Transactions and realized gains in one block with tabs: two long
              tables one after the other made the page endless. */}
          <ActivityCard
            transactions={transactions}
            gains={gains}
            gainsYear={gainsYear}
            gainsYears={gainYears.length > 0 ? gainYears : [new Date().getFullYear()]}
            onGainsYearChange={setGainsYear}
            locale={locale}
            money={money}
            labels={{
              tabs: t.activityTabs.value,
              transactions: {
                title: t.transactionsTab.value,
                empty: t.noTransactions.value,
                date: t.date.value,
                wallet: t.wallet.value,
                counterparty: t.counterparty.value,
                amount: t.amount.value,
                worth: t.worth.value,
                received: t.received.value,
                sent: t.sent.value,
                receivedFrom: t.receivedFrom.value,
                sentTo: t.sentTo.value,
              },
              gains: {
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
                acquiredUnknown: t.acquiredUnknown.value,
                totalRealized: t.totalRealized.value,
                lotCount: t.lotCount.value,
                showUncovered: t.showUncovered.value,
                hideUncovered: t.hideUncovered.value,
              },
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
