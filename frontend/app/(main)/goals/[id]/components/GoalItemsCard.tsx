'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { Trash2 } from '@/app/components/icons';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { InvoiceLineIcon } from '@/app/components/ui/empty-state-icons';
import {
  fillTemplateNodes,
  PRIVATE_CLASS,
  PrivateAmount,
} from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { GoalItem, GoalItemsResponse } from '@/app/lib/goals-api';
import { tokens } from '@/lib/theme-tokens';
import { formatGoalMonth } from './goal-dates';

export interface GoalItemsCardProps {
  data: GoalItemsResponse;
  locale: string;
  onAdd: () => void;
  onEdit: (item: GoalItem) => void;
  onRemove: (itemId: string) => void;
}

/**
 * The goal's cost lines, and how they add up against the declared target.
 *
 * The comparison at the bottom is the reason the list exists: a relocation
 * whose estimate has quietly grown past the number saved for it is the failure
 * mode worth catching months ahead, not on the day of the move.
 */
export function GoalItemsCard({
  data,
  locale,
  onAdd,
  onEdit,
  onRemove,
}: GoalItemsCardProps): React.JSX.Element {
  const t = useIntlayer('goalDetailPage');
  const money = (value: number): string => formatMoney(value, data.currency, locale);
  const { summary } = data;
  const isEmpty = data.items.length === 0;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 2.5,
        mt: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 1.5,
        }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>
          {t.itemsTitle}
        </Typography>
        {/* Empty, the button lives in the empty state: one way to add, not two. */}
        {!isEmpty && (
          <Button size="small" onClick={onAdd}>
            {t.itemsAdd}
          </Button>
        )}
      </Box>

      {isEmpty ? (
        <EmptyState
          compact
          size="sm"
          icon={<InvoiceLineIcon />}
          description={t.itemsEmpty}
          action={
            <Button variant="outlined" size="small" onClick={onAdd}>
              {t.itemsAdd}
            </Button>
          }
        />
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data.items.map(item => (
              <Box
                key={item.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: tokens.radius.md,
                  bgcolor: 'background.paper',
                  px: 2,
                  py: 1.5,
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => onEdit(item)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    background: 'none',
                    border: 0,
                    p: 0,
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit',
                  }}
                >
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: 600,
                    }}
                  >
                    {item.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {item.dueMonth ? formatGoalMonth(item.dueMonth, locale) : '—'}
                  </Typography>
                </Box>

                <Box sx={{ textAlign: 'right' }}>
                  <Typography
                    variant="body2"
                    className={PRIVATE_CLASS}
                    sx={{
                      fontWeight: 600,
                    }}
                  >
                    {formatMoney(item.actualAmount ?? item.estimatedAmount, item.currency, locale)}
                  </Typography>
                  {/* Both numbers only when they differ: repeating the estimate
                      beside an identical actual is noise on every settled line. */}
                  {item.actualAmount !== null && item.actualAmount !== item.estimatedAmount && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t.itemsEstimate}{' '}
                      <PrivateAmount>
                        {formatMoney(item.estimatedAmount, item.currency, locale)}
                      </PrivateAmount>
                    </Typography>
                  )}
                </Box>

                {item.status === 'paid' && (
                  <Chip size="small" color="success" label={t.itemsPaid.value} />
                )}

                <IconButton
                  size="small"
                  aria-label={t.itemDelete.value}
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              display: 'flex',
              gap: 3,
              flexWrap: 'wrap',
              mt: 1.5,
              color: 'text.secondary',
            }}
          >
            <Typography variant="caption">
              {t.itemsEstimate}: <PrivateAmount>{money(summary.estimatedTotal)}</PrivateAmount>
            </Typography>
            <Typography variant="caption">
              {t.itemsPaid}: <PrivateAmount>{money(summary.paidTotal)}</PrivateAmount>
            </Typography>
            <Typography variant="caption">
              {t.itemsOutstanding}: <PrivateAmount>{money(summary.outstanding)}</PrivateAmount>
            </Typography>
          </Box>

          {summary.unallocated < 0 ? (
            <Typography variant="body2" color="error" sx={{ mt: 1, fontWeight: 600 }}>
              {fillTemplateNodes(t.itemsOverTarget.value, { amount: money(-summary.unallocated) })}
            </Typography>
          ) : summary.unallocated > 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              {fillTemplateNodes(t.itemsUnallocated.value, { amount: money(summary.unallocated) })}
            </Typography>
          ) : null}
        </>
      )}
    </Box>
  );
}
