'use client';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { Select } from '@/app/components/ui/select';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { SubscriptionDetail } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import type { SubscriptionItem, SubscriptionWorkspaceMember } from '../hooks/useSubscriptionsPage';
import { RISK_LABELS, STATUS_LABELS } from './SubscriptionCard';

interface SubscriptionDetailsDrawerProps {
  subscription: SubscriptionItem | null;
  members: SubscriptionWorkspaceMember[];
  onClose: () => void;
  onAssignOwner: (id: string, ownerId: string) => Promise<void>;
  onDecision: (
    id: string,
    decision: 'keep' | 'review' | 'cancelled' | 'price_reduced',
    values?: { note?: string; reviewAt?: string; realizedAnnualSavings?: number },
  ) => Promise<void>;
}

const DECISION_LABELS: Record<
  string,
  'keep' | 'markReview' | 'statusCancelled' | 'decisionPriceReduced'
> = {
  keep: 'keep',
  review: 'markReview',
  cancelled: 'statusCancelled',
  price_reduced: 'decisionPriceReduced',
};

/** The status as a dot and a word: sage while it runs, grey once it stops. */
const STATUS_TONE: Record<SubscriptionItem['status'], 'good' | 'quiet'> = {
  active: 'good',
  detected: 'quiet',
  paused: 'quiet',
  cancelled: 'quiet',
};

/** `GET /subscriptions/:id`: charges and decisions behind the card. */
type SubscriptionDetails = SubscriptionDetail;

/** Whole units unless the price has cents: "₪42", "$9.99". */
const money = (amount: number, currency: string, locale: string): string =>
  formatMoney(amount, currency, locale, { fractionDigits: Number.isInteger(amount) ? 0 : 2 });

export function SubscriptionDetailsDrawer({
  subscription,
  members,
  onClose,
  onAssignOwner,
  onDecision,
}: SubscriptionDetailsDrawerProps) {
  const t = useIntlayer('subscriptionsPage');
  const { locale } = useLocale();
  const [ownerId, setOwnerId] = useState('');
  const [note, setNote] = useState('');
  const [reviewAt, setReviewAt] = useState('');
  const [annualSavings, setAnnualSavings] = useState('');
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [reviewChoice, setReviewChoice] = useState<'keep' | 'review' | null>(null);

  useEffect(() => {
    if (!subscription) return;
    setReviewChoice(null);
    void apiQueryDecoded({
      url: `/subscriptions/${subscription.id}`,
      contract: 'SubscriptionDetail',
    })
      .then(setDetails)
      .catch(() => setDetails(null));
  }, [subscription]);

  if (!subscription) return null;
  const assignableOwnerId = ownerId || subscription.ownerId || '';
  const ownerChanged = Boolean(ownerId) && ownerId !== subscription.ownerId;
  // "Oct 2, 2027": a day-first or month-first number can be read both ways.
  const formatDate = (value: string | null): string =>
    value
      ? formatStoredDateWithOptions(
          value,
          { year: 'numeric', month: 'short', day: 'numeric' },
          resolveLocale(locale),
        )
      : '—';
  const choice = reviewChoice ?? (subscription.reviewStatus === 'needs_review' ? 'review' : 'keep');
  const savings = Number(annualSavings) || 0;

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
          <span className="lumio-sub-detail__dot" data-tone={STATUS_TONE[subscription.status]}>
            {t[STATUS_LABELS[subscription.status]].value}
          </span>
          {subscription.riskStatus !== 'none' && (
            <span className="lumio-sub-detail__dot" data-tone="attention">
              {t[RISK_LABELS[subscription.riskStatus]].value}
            </span>
          )}
        </div>
        <div className="lumio-sub-detail__amount">
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
        </dl>

        <section className="lumio-sub-detail__section">
          <h3 className="lumio-sub-detail__heading">{t.chargeHistory.value}</h3>
          {details?.charges.length ? (
            details.charges.map(charge => (
              <p key={charge.id} className="lumio-sub-detail__line">
                {formatDate(charge.chargeDate)} ·{' '}
                {money(Number(charge.amount), charge.currency, locale)} ·{' '}
                {charge.matchStatus.replace('_', ' ')}
              </p>
            ))
          ) : (
            <p className="lumio-sub-detail__empty">{t.noCharges.value}</p>
          )}
        </section>

        <section className="lumio-sub-detail__section">
          <h3 className="lumio-sub-detail__heading">{t.accountability.value}</h3>
          <div className="lumio-sub-detail__field">
            <label id="subscription-owner-label" htmlFor="subscription-owner">
              {t.colOwner.value}
            </label>
            <Select
              id="subscription-owner"
              labelId="subscription-owner-label"
              size="small"
              fullWidth
              value={assignableOwnerId}
              options={[
                { value: '', label: t.unassigned.value },
                ...members.map(member => ({
                  value: member.id,
                  label: member.name || member.email || member.id,
                })),
              ]}
              onChange={setOwnerId}
            />
            {/* Only a different person needs confirming: the link appears with the change. */}
            {ownerChanged && (
              <Button
                variant="text"
                size="small"
                className="lumio-sub-detail__link"
                onClick={() => void onAssignOwner(subscription.id, ownerId)}
              >
                {t.assignOwner.value}
              </Button>
            )}
          </div>
          <div className="lumio-sub-detail__field">
            <label htmlFor="subscription-review-date">{t.reviewDate.value}</label>
            <CustomDatePicker
              id="subscription-review-date"
              compact
              value={reviewAt || subscription.reviewAt?.slice(0, 10) || ''}
              onChange={setReviewAt}
            />
          </div>
          {/* Keep and Review are the subscription's two states, not two actions. */}
          <TextTabs
            ariaLabel={t.accountability.value}
            value={choice}
            onChange={next => {
              setReviewChoice(next);
              void onDecision(subscription.id, next, { reviewAt: reviewAt || undefined });
            }}
            options={[
              { value: 'keep', label: t.keep.value },
              { value: 'review', label: t.markReview.value },
            ]}
          />
        </section>

        <section className="lumio-sub-detail__section">
          <h3 className="lumio-sub-detail__heading">{t.recordDecision.value}</h3>
          <div className="lumio-sub-detail__field">
            <label htmlFor="subscription-reason">{t.reason.value}</label>
            <TextField
              id="subscription-reason"
              value={note}
              onChange={event => setNote(event.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          </div>
          <div className="lumio-sub-detail__field">
            <label htmlFor="subscription-savings">{t.realizedAnnualSavings.value}</label>
            <TextField
              id="subscription-savings"
              type="number"
              value={annualSavings}
              onChange={event => setAnnualSavings(event.target.value)}
              fullWidth
              size="small"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">{subscription.currency}</InputAdornment>
                  ),
                },
              }}
            />
          </div>
          <div className="lumio-sub-detail__actions">
            <Button
              variant="outlined"
              onClick={() =>
                void onDecision(subscription.id, 'price_reduced', {
                  note,
                  realizedAnnualSavings: savings,
                })
              }
            >
              {t.recordPriceReduction.value}
            </Button>
            {/* Destructive, so text in terracotta rather than a second framed button. */}
            <Button
              variant="text"
              className="lumio-sub-detail__destructive"
              onClick={() =>
                void onDecision(subscription.id, 'cancelled', {
                  note,
                  realizedAnnualSavings: savings,
                })
              }
            >
              {t.recordCancellation.value}
            </Button>
          </div>
        </section>

        <section className="lumio-sub-detail__section">
          <h3 className="lumio-sub-detail__heading">{t.decisionHistory.value}</h3>
          {details?.decisions.length ? (
            details.decisions.map(decision => (
              <p key={decision.id} className="lumio-sub-detail__line">
                {formatDate(decision.createdAt)} ·{' '}
                {DECISION_LABELS[decision.decision]
                  ? t[DECISION_LABELS[decision.decision]].value
                  : decision.decision}
                {decision.note ? ` — ${decision.note}` : ''}
              </p>
            ))
          ) : (
            <p className="lumio-sub-detail__empty">{t.noDecisions.value}</p>
          )}
        </section>
      </div>
    </DrawerShell>
  );
}
