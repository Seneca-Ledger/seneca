'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type React from 'react';
import { Trash2 } from '@/app/components/icons';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { GoalDetail } from '@/app/lib/contracts';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';

type Movement = GoalDetail['contributions'][number];

interface RowActions {
  formatAmount: (value: number) => string;
  removing: boolean;
  onRemove: (contributionId: string) => void;
}

export interface GoalMovementsCardProps extends RowActions {
  contributions: readonly Movement[];
}

/** Where a linked movement came from: its receipt if it has one, else its statement. */
function sourceHref(movement: Movement): string | null {
  const source = movement.transaction;
  if (source?.receiptId) {
    return `/storage/receipts/${source.receiptId}`;
  }
  return source?.statementId ? `/statements/${source.statementId}/edit` : null;
}

function MovementRow({
  movement,
  formatAmount,
  removing,
  onRemove,
}: RowActions & { movement: Movement }): React.JSX.Element {
  const t = useIntlayer('goalMovementsCard');
  const href = sourceHref(movement);
  const label = movement.transaction?.counterpartyName || movement.note || t.manual.value;
  const amount = Math.abs(movement.amount);
  return (
    <Box
      component="li"
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, minHeight: 36 }}
    >
      <Typography sx={{ fontSize: 13, color: 'var(--text-muted)', width: 96, flexShrink: 0 }}>
        {formatStoredDate(movement.contributionDate)}
      </Typography>
      <Typography sx={{ fontSize: 14, flex: 1, minWidth: 0 }} noWrap>
        {href ? (
          <Link href={href} style={{ color: 'var(--primary)' }}>
            {label}
          </Link>
        ) : (
          label
        )}
      </Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
        <PrivateAmount>
          {movement.amount < 0 ? `−${formatAmount(amount)}` : formatAmount(amount)}
        </PrivateAmount>
      </Typography>
      {/* A linked movement is undone where it was linked, so the two never disagree. */}
      <Box sx={{ width: 32, flexShrink: 0 }}>
        {!movement.transaction && (
          <IconButton
            size="small"
            aria-label={t.remove.value}
            disabled={removing}
            onClick={() => onRemove(movement.id)}
          >
            <Trash2 size={16} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

function MovementSection({
  title,
  rows,
  ...actions
}: RowActions & { title: string; rows: Movement[] }): React.JSX.Element | null {
  if (rows.length === 0) {
    return null;
  }
  const total = rows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const caption = { fontSize: 13, color: 'var(--text-muted)' };
  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Typography sx={{ ...caption, fontWeight: 500 }}>{title}</Typography>
        <Typography sx={{ ...caption, fontVariantNumeric: 'tabular-nums' }}>
          <PrivateAmount>{actions.formatAmount(total)}</PrivateAmount>
        </Typography>
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {rows.map(movement => (
          <MovementRow key={movement.id} movement={movement} {...actions} />
        ))}
      </Box>
    </Box>
  );
}

/**
 * Everything that moved the goal, with what was taken out kept apart from what
 * was put aside: a loss on the way to a goal is the thing worth seeing, and
 * mixed into one list it reads as a smaller deposit.
 */
export function GoalMovementsCard({
  contributions,
  ...actions
}: GoalMovementsCardProps): React.JSX.Element | null {
  const t = useIntlayer('goalMovementsCard');
  if (contributions.length === 0) {
    return null;
  }
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
      <Typography sx={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>
        {t.title}
      </Typography>
      <MovementSection
        title={t.takenOutTitle.value}
        rows={contributions.filter(movement => movement.amount < 0)}
        {...actions}
      />
      <MovementSection
        title={t.putAsideTitle.value}
        rows={contributions.filter(movement => movement.amount >= 0)}
        {...actions}
      />
    </Box>
  );
}
