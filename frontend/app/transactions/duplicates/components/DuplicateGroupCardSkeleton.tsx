import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { Calendar, DollarSign, User } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

const ICON_STYLE = { color: 'var(--muted-foreground)', flexShrink: 0 } as const;
const CAPTION_SX = {
  fontSize: 10,
  letterSpacing: '0.1em',
  fontWeight: 700,
  textTransform: 'uppercase',
} as const;
const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(4, minmax(0, 1fr))' },
  gap: 2,
} as const;

/** Date, amount, counterparty and purpose of one transaction, as placeholders. */
function TransactionLine(): React.JSX.Element {
  return (
    <Box sx={GRID_SX}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Calendar size={16} style={ICON_STYLE} />
        <Skeleton variant="text" width={80} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DollarSign size={16} style={ICON_STYLE} />
        <Skeleton variant="text" width={64} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <User size={16} style={ICON_STYLE} />
        <Skeleton variant="text" width="70%" />
      </Box>
      <Skeleton variant="text" width="80%" />
    </Box>
  );
}

/** A duplicate group while the groups load: the card of DuplicateGroupCard with placeholders. */
export function DuplicateGroupCardSkeleton(): React.JSX.Element {
  const t = useIntlayer('transactionDuplicatesPage');
  return (
    <Box
      aria-busy="true"
      sx={{ border: '1px solid var(--border-color)', bgcolor: 'background.paper', p: 3 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Checkbox disabled sx={{ mt: 0.5, p: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Skeleton
                variant="rounded"
                width={84}
                height={24}
                sx={{ borderRadius: tokens.radius.full }}
              />
              <Skeleton variant="text" width={90} />
            </Box>
            <Button variant="text" size="small" disabled>
              {t.card.showDetails}
            </Button>
          </Box>
          <Box
            sx={{
              bgcolor: 'var(--color-success-soft-bg)',
              p: 2,
              mb: 2,
              border: '1px solid var(--color-success-soft-border)',
            }}
          >
            <Typography sx={{ ...CAPTION_SX, mb: 1, color: 'var(--color-success-soft-text)' }}>
              {t.card.master}
            </Typography>
            <TransactionLine />
          </Box>
          <Box sx={{ bgcolor: 'var(--muted)', p: 2, border: '1px solid var(--border-color)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ ...CAPTION_SX, color: 'var(--destructive)' }}>
                {t.card.duplicateN.value.replace('{n}', '1')}
              </Typography>
              <Skeleton
                variant="rounded"
                width={56}
                height={24}
                sx={{ borderRadius: tokens.radius.full }}
              />
            </Box>
            <TransactionLine />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
