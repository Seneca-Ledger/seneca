'use client';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { extractUploadErrorMessage } from '@/app/(main)/statements/components/statement-upload';
import { Pencil } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { formatMoney } from '@/app/lib/format-money';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import type { SubscriptionItem } from '../hooks/useSubscriptionsPage';
import { fetchBudgets } from '../../budgets/hooks/useBudgetsPage';
import { RISK_LABELS, STATUS_LABELS } from './SubscriptionCard';
import { SubscriptionPayments } from './SubscriptionPayments';

interface SubscriptionDetailsDrawerProps {
  subscription: SubscriptionItem | null;
  onClose: () => void;
  /** Opens the subscription's form: name, price, currency, frequency, dates. */
  onEdit: () => void;
  onDecision: (id: string, decision: 'cancelled') => Promise<void>;
  /** Pause, resume, or bring a cancelled one back. */
  onStatusChange: (id: string, status: 'active' | 'paused') => Promise<void>;
}

/** The status as a dot and a word: sage while it runs, grey once it stops. */
const STATUS_TONE: Record<SubscriptionItem['status'], 'good' | 'quiet'> = {
  active: 'good',
  detected: 'quiet',
  paused: 'quiet',
  cancelled: 'quiet',
};

/** Whole units unless the price has cents: "₪42", "$9.99". */
const money = (amount: number, currency: string, locale: string): string =>
  formatMoney(amount, currency, locale, { fractionDigits: Number.isInteger(amount) ? 0 : 2 });

export function SubscriptionDetailsDrawer({
  subscription,
  onClose,
  onEdit,
  onDecision,
  onStatusChange,
}: SubscriptionDetailsDrawerProps) {
  const t = useIntlayer('subscriptionsPage');
  const paymentsText = useIntlayer('subscriptionPayments');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const id = subscription?.id ?? '';
  const detail = useQuery({
    queryKey: queryKeys.subscriptionDetail({ workspaceId, id }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/subscriptions/${id}`, signal, contract: 'SubscriptionDetail' }),
    enabled: Boolean(id && workspaceId),
  });
  const budgets = useQuery({
    queryKey: queryKeys.budgets(workspaceId),
    queryFn: ({ signal }) => fetchBudgets(signal),
    enabled: Boolean(subscription?.budgetId && workspaceId),
  });
  const budgetName = budgets.data?.find(budget => budget.id === subscription?.budgetId)?.name;

  if (!subscription) return null;
  // The list row the card opened with goes stale after a pause or a resume;
  // the detail is refetched with every change.
  const status = detail.data?.subscription.status ?? subscription.status;
  // Every change moves dates and totals: the list, the card and the dashboard refetch.
  const savePayment = async (request: () => Promise<unknown>) => {
    try {
      await request();
    } catch (error) {
      toast.error(extractUploadErrorMessage(error, paymentsText.paymentFailed.value));
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['subscriptions', workspaceId] });
    }
  };
  const chargesUrl = `/subscriptions/${subscription.id}/charges`;
  // "Oct 2, 2027": a day-first or month-first number can be read both ways.
  const formatDate = (value: string | null): string =>
    value
      ? formatStoredDateWithOptions(
          value,
          { year: 'numeric', month: 'short', day: 'numeric' },
          resolveLocale(locale),
        )
      : '—';

  return (
    <DrawerShell
      isOpen={Boolean(subscription)}
      onClose={onClose}
      title={subscription.vendorName}
      width="lg"
    >
      <div className="lumio-sub-detail">
        <div className="lumio-sub-detail__status">
          <VendorIcon
            vendorName={subscription.vendorName}
            vendorDomain={subscription.vendorDomain}
            size={28}
          />
          <span className="lumio-sub-detail__dot" data-tone={STATUS_TONE[status]}>
            {t[STATUS_LABELS[status]].value}
          </span>
          {subscription.riskStatus !== 'none' && (
            <span className="lumio-sub-detail__dot" data-tone="attention">
              {t[RISK_LABELS[subscription.riskStatus]].value}
            </span>
          )}
          <IconButton
            size="small"
            className="lumio-sub-detail__edit"
            aria-label={t.editSubscription.value}
            title={t.editSubscription.value}
            onClick={onEdit}
          >
            <Pencil size={16} />
          </IconButton>
        </div>
        <div className={`lumio-sub-detail__amount ${PRIVATE_CLASS}`}>
          {money(subscription.amount, subscription.currency, locale)}
        </div>
        <dl className="lumio-sub-detail__facts">
          <div>
            <dt>{t.expectedCharge.value}</dt>
            <dd>{formatDate(subscription.nextChargeDate)}</dd>
          </div>
          <div>
            <dt>{t.lastCharge.value}</dt>
            <dd>{formatDate(subscription.lastChargeDate)}</dd>
          </div>
          {budgetName && (
            <div>
              <dt>{t.budget.value}</dt>
              <dd>{budgetName}</dd>
            </div>
          )}
        </dl>

        <SubscriptionPayments
          payments={(detail.data?.charges ?? []).map(charge => ({
            key: charge.id,
            date: charge.chargeDate,
            amount: Number(charge.amount),
            currency: charge.currency,
            linked: Boolean(charge.transactionId),
          }))}
          vendorName={subscription.vendorName}
          defaultAmount={subscription.amount}
          autoLinkPayees={detail.data?.autoLinkPayees}
          onAddManual={(chargeDate, amount) =>
            savePayment(() =>
              apiClient.post(chargesUrl, {
                chargeDate,
                amount,
              } satisfies ContractInput<'RecordSubscriptionChargeBody'>),
            )
          }
          onAddRows={async rows => {
            for (const row of rows) {
              await savePayment(() =>
                apiClient.post(chargesUrl, {
                  transactionId: row.transactionId,
                } satisfies ContractInput<'RecordSubscriptionChargeBody'>),
              );
            }
          }}
          onLinkRow={(chargeId, row) =>
            savePayment(() =>
              apiClient.patch(`${chargesUrl}/${chargeId}`, {
                transactionId: row.transactionId,
              } satisfies ContractInput<'LinkSubscriptionChargeBody'>),
            )
          }
          onRemove={chargeId => savePayment(() => apiClient.delete(`${chargesUrl}/${chargeId}`))}
        />

        <div className="lumio-sub-detail__actions">
          {/* Moving between running and stopped: quiet sage text. */}
          {status === 'active' && (
            <Button
              variant="text"
              className="lumio-sub-detail__link"
              onClick={() => void onStatusChange(subscription.id, 'paused')}
            >
              {t.pauseSubscription.value}
            </Button>
          )}
          {status === 'paused' && (
            <Button
              variant="text"
              className="lumio-sub-detail__link"
              onClick={() => void onStatusChange(subscription.id, 'active')}
            >
              {t.resumeSubscription.value}
            </Button>
          )}
          {status === 'cancelled' && (
            <Button
              variant="text"
              className="lumio-sub-detail__link"
              onClick={() => void onStatusChange(subscription.id, 'active')}
            >
              {t.reactivateSubscription.value}
            </Button>
          )}
          {/* Destructive, so text in terracotta rather than a framed button. */}
          {status !== 'cancelled' && (
            <Button
              variant="text"
              className="lumio-sub-detail__destructive"
              onClick={() => void onDecision(subscription.id, 'cancelled')}
            >
              {t.recordCancellation.value}
            </Button>
          )}
        </div>
      </div>
    </DrawerShell>
  );
}
