'use client';
import { Box, Button, Card, CardContent, Chip, IconButton, Typography } from '@mui/material';

import { Pencil, Trash2 } from '@/app/components/icons';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { resolveLocaleTag } from '@/app/lib/user-format';
import {
  formatStoredDateWithOptions,
  readStoredFormatPreferences,
} from '@/app/lib/user-format-store';
import { priceChangeOf, type SubscriptionItem } from '../hooks/useSubscriptionsPage';

interface SubscriptionCardProps {
  subscription: SubscriptionItem;
  onEdit: () => void;
  onDelete: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onUse?: () => void;
  onSinkingFund?: () => void;
  duplicate?: boolean;
}

/** What to put aside each month so a quarterly or annual charge does not land as a surprise. */
export function monthlySetAsideOf(subscription: SubscriptionItem): number | null {
  if (subscription.frequency === 'annual') return subscription.amount / 12;
  if (subscription.frequency === 'quarterly') return subscription.amount / 3;
  return null;
}

const STATUS_COLORS: Record<string, 'warning' | 'success' | 'default' | 'error'> = {
  detected: 'warning',
  active: 'success',
  paused: 'default',
  cancelled: 'error',
};

const FREQUENCY_LABELS = {
  weekly: 'freqWeek',
  monthly: 'freqMonth',
  quarterly: 'freqQuarter',
  annual: 'freqYear',
} as const;

export const STATUS_LABELS = {
  detected: 'statusDetected',
  active: 'statusActive',
  paused: 'statusPaused',
  cancelled: 'statusCancelled',
} as const;

export const RISK_LABELS = {
  price_changed: 'riskPriceChanged',
  date_shifted: 'riskDateShifted',
  missing_charge: 'riskMissingCharge',
} as const;

/**
 * The `?focus=` groups a subscription answers (see useAttentionFocus):
 * `price-changed` is the dashboard's "Price changed" chip.
 */
export const attentionGroups = (subscription: SubscriptionItem): string | undefined =>
  subscription.riskStatus === 'price_changed' ? 'price-changed' : undefined;

export function SubscriptionCard({
  subscription,
  onEdit,
  onDelete,
  onConfirm,
  onDismiss,
  onUse,
  onSinkingFund,
  duplicate = false,
}: SubscriptionCardProps) {
  const t = useIntlayer('subscriptionsPage');
  const { locale } = useLocale();
  const formatAmount = (amount: number, currency: string) =>
    `${new Intl.NumberFormat(resolveLocaleTag(readStoredFormatPreferences().locale), {
      maximumFractionDigits: 0,
    }).format(amount)} ${currency}`;
  const priceChange = priceChangeOf(subscription);
  const setAside = monthlySetAsideOf(subscription);
  const fill = (template: string, values: Record<string, string>) =>
    Object.entries(values).reduce(
      (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
      template,
    );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return formatStoredDateWithOptions(dateStr, { day: 'numeric', month: 'short' });
  };

  return (
    <Card
      variant="outlined"
      data-attention={`subscription:${subscription.id}`}
      data-attention-group={attentionGroups(subscription)}
      sx={{ position: 'relative' }}
    >
      <CardContent sx={{ pb: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* Header */}
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VendorIcon
                vendorName={subscription.vendorName}
                vendorDomain={subscription.vendorDomain}
              />
              <Typography
                variant="subtitle1"
                noWrap
                sx={{
                  fontWeight: 600,
                }}
              >
                {subscription.vendorName}
              </Typography>
            </Box>
            <Typography
              variant="h6"
              color="primary"
              sx={{
                fontWeight: 700,
              }}
            >
              <PrivateAmount>
                {formatAmount(subscription.amount, subscription.currency)}
              </PrivateAmount>
              <Typography
                component="span"
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t[FREQUENCY_LABELS[subscription.frequency]]}
              </Typography>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {duplicate && (
              <Chip label={t.duplicateChip.value} size="small" color="warning" variant="outlined" />
            )}
            <Chip
              label={t[STATUS_LABELS[subscription.status]].value}
              size="small"
              color={STATUS_COLORS[subscription.status] ?? 'default'}
              variant="outlined"
            />
          </Box>
        </Box>
        {priceChange && subscription.riskStatus === 'price_changed' && (
          <Typography
            variant="body2"
            sx={{
              color: 'warning.main',
              mb: 1,
            }}
          >
            {fillTemplateNodes(t.priceChangeDetail.value, {
              previous: formatAmount(priceChange.previous, subscription.currency),
              current: formatAmount(priceChange.current, subscription.currency),
              delta: formatAmount(priceChange.delta, subscription.currency),
              yearly: formatAmount(priceChange.yearlyDelta, subscription.currency),
            })}
          </Typography>
        )}

        {/* Details */}
        <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
          {subscription.nextChargeDate && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.nextCharge.value.replace('{date}', formatDate(subscription.nextChargeDate))}
            </Typography>
          )}
          {subscription.category && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {getCategoryDisplayName(subscription.category, locale)}
            </Typography>
          )}
          {typeof subscription.costPerUse === 'number' && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {fillTemplateNodes(
                fill(t.costPerUse.value, { count: String(subscription.usageCount ?? 0) }),
                { amount: formatAmount(subscription.costPerUse, subscription.currency) },
              )}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {subscription.status === 'detected' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="contained" onClick={onConfirm}>
                {t.confirm}
              </Button>
              <Button size="small" variant="outlined" color="inherit" onClick={onDismiss}>
                {t.dismiss}
              </Button>
            </Box>
          ) : subscription.status === 'active' ? (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {onUse && (
                <Button size="small" variant="outlined" color="inherit" onClick={onUse}>
                  {t.usedIt}
                </Button>
              )}
              {setAside !== null &&
                (subscription.sinkingGoalId ? (
                  <Chip label={t.sinkingFundLinked.value} size="small" variant="outlined" />
                ) : (
                  onSinkingFund && (
                    <Button size="small" variant="outlined" color="inherit" onClick={onSinkingFund}>
                      {fillTemplateNodes(t.setAside.value, {
                        amount: formatAmount(setAside, subscription.currency),
                      })}
                    </Button>
                  )
                ))}
            </Box>
          ) : (
            <Box />
          )}
          <Box>
            <IconButton size="small" onClick={onEdit}>
              <Pencil size={16} />
            </IconButton>
            <IconButton size="small" color="error" onClick={onDelete}>
              <Trash2 size={16} />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
