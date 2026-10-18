'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import {
  type AddPayablePaymentInput,
  type BookPayablePaymentInput,
  type MarkPayablePaidInput,
  type Payable,
  type PayablePayment,
  payablesApi,
} from '@/app/lib/payables-api';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import {
  AmountFields,
  type AmountState,
  CandidateList,
  CashFields,
  type CashState,
  IN_HAND,
  PaymentLog,
  today,
} from './MarkPaidFields';

type Mode = 'match' | 'cash' | 'plain';

/**
 * Settling in full keeps going through `mark-paid` — it guards against a
 * second payment and notifies the workspace. Anything else is one payment
 * among several.
 */
export type MarkPaidResult =
  | { kind: 'full'; payload: MarkPayablePaidInput }
  | { kind: 'payment'; payload: AddPayablePaymentInput }
  /** The money of a payment recorded without it: where it went. */
  | { kind: 'book'; paymentId: string; payload: BookPayablePaymentInput };

type MarkPaidDialogProps = {
  /** The bill being settled; the dialog is closed while null. */
  payable: Payable | null;
  submitting: boolean;
  removingPaymentId?: string | null;
  onClose: () => void;
  onConfirm: (payable: Payable, result: MarkPaidResult) => void;
  onRemovePayment: (payable: Payable, paymentId: string) => void;
};

/**
 * Settles a bill three ways: against a transaction already on a statement,
 * as a cash payment the server records in a wallet, or as a bare status
 * change. Only the first two reach the books.
 */
export function MarkPaidDialog(props: MarkPaidDialogProps): React.JSX.Element | null {
  if (!props.payable) {
    return null;
  }
  // Keyed so that every bill opens with a fresh form.
  return <MarkPaidForm {...props} key={props.payable.id} payable={props.payable} />;
}

/** What the dialog offers for this bill: matching payments, wallets and categories. */
function usePaymentOptions(payable: Payable) {
  const workspaceId = useWorkspaceId();
  const currency = payable.currency.toUpperCase();
  const categoryType = payable.direction === 'receivable' ? 'income' : 'expense';

  const candidates = useQuery({
    queryKey: queryKeys.payablePaymentCandidates({ workspaceId, payableId: payable.id }),
    queryFn: () => payablesApi.paymentCandidates(payable.id),
  });
  const payments = useQuery({
    queryKey: queryKeys.payablePayments({ workspaceId, payableId: payable.id }),
    queryFn: () => payablesApi.payments(payable.id),
  });
  const wallets = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
  });

  return {
    currency,
    candidates: candidates.data ?? [],
    candidatesLoading: candidates.isPending,
    payments: (payments.data ?? []) as PayablePayment[],
    wallets: (wallets.data ?? []).filter(
      wallet => wallet.isActive !== false && wallet.currency.toUpperCase() === currency,
    ),
    walletsLoading: wallets.isPending,
    categories: (categories.data ?? []).filter(category => category.type === categoryType),
  };
}

function buildResult(
  mode: Mode,
  selected: {
    transactionId: string | null;
    cash: CashState;
    amount: AmountState;
    outstanding: number;
  },
): MarkPaidResult | null {
  const amount = Math.round(Number(selected.amount.amount) * 100) / 100;
  const fee = Math.round(Number(selected.amount.feeAmount || 0) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > selected.outstanding + 0.005) {
    return null;
  }
  const settlesInFull = amount >= selected.outstanding - 0.005 && fee <= 0;

  if (mode === 'match') {
    if (!selected.transactionId) {
      return null;
    }
    return settlesInFull
      ? { kind: 'full', payload: { linkedTransactionId: selected.transactionId } }
      : {
          kind: 'payment',
          payload: {
            amount,
            feeAmount: fee || undefined,
            linkedTransactionId: selected.transactionId,
          },
        };
  }
  if (mode === 'cash') {
    const { walletId, paidOn, categoryId } = selected.cash;
    if (!walletId) {
      return null;
    }
    const source = cashSource(walletId);
    return settlesInFull
      ? {
          kind: 'full',
          payload: { ...source, paidOn, categoryId: categoryId || undefined },
        }
      : {
          kind: 'payment',
          payload: {
            amount,
            feeAmount: fee || undefined,
            paidOn,
            ...source,
            categoryId: categoryId || undefined,
          },
        };
  }
  return settlesInFull
    ? { kind: 'full', payload: {} }
    : { kind: 'payment', payload: { amount, feeAmount: fee || undefined } };
}

/** A wallet the cash went into, or cash in hand kept in none. */
function cashSource(walletId: string): { payFromWalletId?: string; inHand?: boolean } {
  return walletId === IN_HAND ? { inHand: true } : { payFromWalletId: walletId };
}

/** For a payment recorded without money: the bank row or the wallet it went into. */
function buildBooking(
  mode: Mode,
  paymentId: string,
  selected: { transactionId: string | null; cash: CashState },
): MarkPaidResult | null {
  if (mode === 'match') {
    return selected.transactionId
      ? { kind: 'book', paymentId, payload: { linkedTransactionId: selected.transactionId } }
      : null;
  }
  if (mode === 'cash' && selected.cash.walletId) {
    return {
      kind: 'book',
      paymentId,
      payload: {
        ...cashSource(selected.cash.walletId),
        categoryId: selected.cash.categoryId || undefined,
      },
    };
  }
  return null;
}

function MarkPaidForm({
  payable,
  submitting,
  removingPaymentId,
  onClose,
  onConfirm,
  onRemovePayment,
}: MarkPaidDialogProps & { payable: Payable }): React.JSX.Element {
  const t = useIntlayer('payableMarkPaid');
  const unbookedText = useIntlayer('payablesUnbooked');
  const { locale } = useLocale();
  const options = usePaymentOptions(payable);

  const [chosenMode, setMode] = useState<Mode | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [cash, setCash] = useState<CashState>({ walletId: null, paidOn: today(), categoryId: '' });
  const [amount, setAmount] = useState<AmountState | null>(null);

  const total = Number(payable.amount);
  const paidSoFar = Math.round(Number(payable.paidAmount ?? 0) * 100) / 100;
  const outstanding = Math.round((total - paidSoFar) * 100) / 100;
  // The form opens on the rest of the bill; the amount follows it until typed in.
  const amountState = amount ?? { amount: outstanding.toFixed(2), feeAmount: '' };

  // Until the user picks, open on the bank match when there is one to pick,
  // with the first candidate and the first wallet preselected.
  // Nothing left to pay, but a payment has no money in an account yet: the
  // dialog asks where that money went instead of for another payment.
  const unbooked =
    outstanding <= 0.005 ? options.payments.find(payment => !payment.transactionId) : undefined;
  const fallbackMode: Mode = options.candidates.length > 0 ? 'match' : unbooked ? 'cash' : 'plain';
  const mode: Mode =
    unbooked && chosenMode === 'plain' ? fallbackMode : (chosenMode ?? fallbackMode);
  // No wallet in the bill's currency: cash in hand is what is left, and it is preselected.
  const selectedCash = {
    ...cash,
    walletId: cash.walletId ?? options.wallets[0]?.id ?? (options.walletsLoading ? null : IN_HAND),
  };
  // A bill already linked (paid, then marked unpaid) keeps its payment unless the user picks another.
  const defaultTransaction =
    options.candidates.find(candidate => candidate.id === payable.linkedTransactionId)?.id ??
    options.candidates[0]?.id ??
    null;
  const result = unbooked
    ? buildBooking(mode, unbooked.id, {
        transactionId: transactionId ?? defaultTransaction,
        cash: selectedCash,
      })
    : buildResult(mode, {
        transactionId: transactionId ?? defaultTransaction,
        cash: selectedCash,
        amount: amountState,
        outstanding,
      });

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      size="sm"
      title={payable.direction === 'receivable' ? t.titleReceived.value : t.titlePaid.value}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t.cancel.value}
          </Button>
          <Button
            onClick={() => result && onConfirm(payable, result)}
            disabled={!result || submitting}
          >
            {t.confirm.value}
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {payable.vendor} · {formatMoney(total, options.currency, locale)}
        </Typography>

        <PaymentLog
          payments={options.payments}
          currency={options.currency}
          locale={locale}
          removingId={removingPaymentId ?? null}
          onRemove={paymentId => onRemovePayment(payable, paymentId)}
        />

        {unbooked ? (
          <Alert severity="info">{unbookedText.bookIntro.value}</Alert>
        ) : (
          <AmountFields
            currency={options.currency}
            locale={locale}
            paidSoFar={paidSoFar}
            outstanding={outstanding}
            value={amountState}
            onChange={setAmount}
          />
        )}

        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_event, next: Mode | null) => next && setMode(next)}
          sx={{ flexWrap: 'wrap' }}
        >
          <ToggleButton value="match" sx={{ textTransform: 'none' }}>
            {t.modeMatch.value}
          </ToggleButton>
          <ToggleButton value="cash" sx={{ textTransform: 'none' }}>
            {t.modeCash.value}
          </ToggleButton>
          {!unbooked && (
            <ToggleButton value="plain" sx={{ textTransform: 'none' }}>
              {t.modePlain.value}
            </ToggleButton>
          )}
        </ToggleButtonGroup>

        {mode === 'match' && (
          <CandidateList
            candidates={options.candidates}
            loading={options.candidatesLoading}
            selected={transactionId ?? defaultTransaction}
            onSelect={setTransactionId}
            locale={locale}
          />
        )}
        {mode === 'cash' && (
          <CashFields
            wallets={options.wallets}
            categories={options.categories}
            value={selectedCash}
            onChange={setCash}
            hideDate={Boolean(unbooked)}
          />
        )}
        {mode === 'plain' && <Alert severity="warning">{t.plainHint.value}</Alert>}
      </Box>
    </ModalShell>
  );
}
