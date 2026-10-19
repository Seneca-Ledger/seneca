'use client';

import { Box, Typography } from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import type { WebhookDeliveryList } from '@/app/lib/contracts';
import { formatStoredDateTime } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { useWebhookDeliveries } from './useWebhooks';
import { EVENT_LABEL_KEY, isWebhookEventName } from './webhook-events';

type DeliveryStatus = WebhookDeliveryList[number]['status'];

const STATUS_COLOR: Record<DeliveryStatus, (theme: Theme) => string> = {
  pending: theme => theme.palette.text.secondary,
  processing: theme => theme.palette.text.secondary,
  success: theme => theme.palette.success.main,
  failed: theme => theme.palette.warning.main,
  exhausted: theme => theme.palette.error.main,
};

/** Delivered ones need nothing; the rest can be sent again. */
const RETRYABLE: ReadonlySet<DeliveryStatus> = new Set(['failed', 'exhausted']);

/** The last deliveries of one subscription, newest first, each retryable when it did not arrive. */
export function WebhookDeliveryLog({
  subscriptionId,
}: {
  subscriptionId: string;
}): React.JSX.Element {
  const t = useIntlayer('webhooksDrawer');
  const { deliveries, loading, retry, retrying } = useWebhookDeliveries(subscriptionId);

  if (loading) {
    return (
      <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.loading}</Typography>
    );
  }
  if (deliveries.length === 0) {
    return (
      <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        {t.noDeliveries}
      </Typography>
    );
  }

  return (
    <Box
      component="ul"
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}
    >
      {deliveries.map(delivery => (
        <Box
          component="li"
          key={delivery.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            borderRadius: tokens.radius.sm,
            border: '1px solid var(--border-color)',
          }}
        >
          <Box
            sx={theme => ({
              px: 1,
              py: 0.25,
              borderRadius: tokens.radius.full,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              color: STATUS_COLOR[delivery.status](theme),
              background: alpha(STATUS_COLOR[delivery.status](theme), 0.1),
            })}
          >
            {t.status[delivery.status]}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {isWebhookEventName(delivery.event)
                ? t.events[EVENT_LABEL_KEY[delivery.event]].value
                : delivery.event}
            </Typography>
            <Typography
              sx={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {formatStoredDateTime(delivery.lastAttemptedAt ?? delivery.createdAt)}
              {' · '}
              {t.attempts.value
                .replace('{count}', String(delivery.attemptCount))
                .replace('{max}', String(delivery.maxAttempts))}
              {delivery.lastResponseCode ? ` · HTTP ${delivery.lastResponseCode}` : ''}
              {delivery.lastError ? ` · ${delivery.lastError}` : ''}
            </Typography>
          </Box>
          {RETRYABLE.has(delivery.status) ? (
            <Box
              component="button"
              type="button"
              disabled={retrying === delivery.id}
              onClick={() => retry(delivery.id)}
              sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: tokens.radius.full,
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t.retry}
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
