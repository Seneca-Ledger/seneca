'use client';
import {
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { formatStoredDate } from '@/app/lib/user-format-store';
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

const formatDate = (value: string | null): string =>
  value ? formatStoredDate(value, 'ru-RU') : '—';

type SubscriptionDetails = {
  charges: Array<{
    id: string;
    amount: number;
    currency: string;
    chargeDate: string;
    matchStatus: string;
  }>;
  decisions: Array<{
    id: string;
    decision: string;
    note: string | null;
    savingsAmount: number | null;
    createdAt: string;
  }>;
};

export function SubscriptionDetailsDrawer({
  subscription,
  members,
  onClose,
  onAssignOwner,
  onDecision,
}: SubscriptionDetailsDrawerProps) {
  const t = useIntlayer('subscriptionsPage');
  const [ownerId, setOwnerId] = useState('');
  const [note, setNote] = useState('');
  const [reviewAt, setReviewAt] = useState('');
  const [annualSavings, setAnnualSavings] = useState('');
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);

  useEffect(() => {
    if (!subscription) return;
    void apiClient
      .get(`/subscriptions/${subscription.id}`)
      .then(response => {
        setDetails(response.data?.data ?? response.data ?? null);
      })
      .catch(() => setDetails(null));
  }, [subscription]);

  if (!subscription) return null;
  const assignableOwnerId = ownerId || subscription.ownerId || '';

  return (
    <DrawerShell
      isOpen={Boolean(subscription)}
      onClose={onClose}
      title={subscription.vendorName}
      width="lg"
    >
      <Stack spacing={2} sx={{ overflowY: 'auto', pr: 0.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <VendorIcon
            vendorName={subscription.vendorName}
            vendorDomain={subscription.vendorDomain}
          />
          <Chip
            label={t[STATUS_LABELS[subscription.status]].value}
            size="small"
            color={subscription.status === 'active' ? 'success' : 'default'}
          />
          {subscription.riskStatus !== 'none' && (
            <Chip
              label={t[RISK_LABELS[subscription.riskStatus]].value}
              size="small"
              color="warning"
            />
          )}
        </Stack>
        <Typography variant="h5" fontWeight={700}>
          {subscription.amount} {subscription.currency}
        </Typography>
        <Typography color="text.secondary">
          {t.expectedLastCharge.value
            .replace('{next}', formatDate(subscription.nextChargeDate))
            .replace('{last}', formatDate(subscription.lastChargeDate))}
        </Typography>
        <Typography variant="subtitle2">{t.chargeHistory}</Typography>
        {details?.charges.length ? (
          details.charges.map(charge => (
            <Typography key={charge.id} variant="body2">
              {formatDate(charge.chargeDate)} · {charge.amount} {charge.currency} ·{' '}
              {charge.matchStatus.replace('_', ' ')}
            </Typography>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t.noCharges}
          </Typography>
        )}
        <Divider />
        <Typography variant="subtitle2">{t.accountability}</Typography>
        <FormControl fullWidth size="small">
          <InputLabel id="subscription-owner-label">{t.colOwner}</InputLabel>
          <Select
            labelId="subscription-owner-label"
            label={t.colOwner.value}
            value={assignableOwnerId}
            onChange={event => setOwnerId(event.target.value)}
          >
            <MenuItem value="">
              <em>{t.unassigned}</em>
            </MenuItem>
            {members.map(member => (
              <MenuItem key={member.id} value={member.id}>
                {member.name || member.email || member.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          disabled={!ownerId || ownerId === subscription.ownerId}
          onClick={() => void onAssignOwner(subscription.id, ownerId)}
        >
          {t.assignOwner}
        </Button>
        <CustomDatePicker
          label={t.reviewDate.value}
          value={reviewAt || subscription.reviewAt?.slice(0, 10) || ''}
          onChange={setReviewAt}
        />
        <Stack direction="row" spacing={1}>
          <Button
            fullWidth
            variant="contained"
            onClick={() =>
              void onDecision(subscription.id, 'keep', { reviewAt: reviewAt || undefined })
            }
          >
            {t.keep}
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={() =>
              void onDecision(subscription.id, 'review', { reviewAt: reviewAt || undefined })
            }
          >
            {t.markReview}
          </Button>
        </Stack>
        <Divider />
        <Typography variant="subtitle2">{t.recordDecision}</Typography>
        <TextField
          label={t.reason.value}
          value={note}
          onChange={event => setNote(event.target.value)}
          multiline
          minRows={2}
          fullWidth
        />
        <TextField
          label={t.realizedAnnualSavings.value}
          type="number"
          value={annualSavings}
          onChange={event => setAnnualSavings(event.target.value)}
          fullWidth
          size="small"
        />
        <Stack direction="row" spacing={1}>
          <Button
            color="error"
            variant="outlined"
            onClick={() =>
              void onDecision(subscription.id, 'cancelled', {
                note,
                realizedAnnualSavings: Number(annualSavings) || 0,
              })
            }
          >
            {t.recordCancellation}
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              void onDecision(subscription.id, 'price_reduced', {
                note,
                realizedAnnualSavings: Number(annualSavings) || 0,
              })
            }
          >
            {t.recordPriceReduction}
          </Button>
        </Stack>
        <Typography variant="subtitle2">{t.decisionHistory}</Typography>
        {details?.decisions.length ? (
          details.decisions.map(decision => (
            <Typography key={decision.id} variant="body2">
              {formatDate(decision.createdAt)} ·{' '}
              {DECISION_LABELS[decision.decision]
                ? t[DECISION_LABELS[decision.decision]].value
                : decision.decision}
              {decision.note ? ` — ${decision.note}` : ''}
            </Typography>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t.noDecisions}
          </Typography>
        )}
      </Stack>
    </DrawerShell>
  );
}
