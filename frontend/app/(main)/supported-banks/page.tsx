'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Image from 'next/image';
import { CheckCircle2 } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { tokens } from '@/lib/theme-tokens';

type SupportedBankCard = {
  id: string;
  logo: string;
  name: string;
  notes: string;
};

// eslint-disable-next-line max-lines-per-function
export default function SupportedBanksPage(): React.JSX.Element {
  const t = useIntlayer('supportedBanksPage');

  const banks: SupportedBankCard[] = [
    {
      id: 'kaspi',
      logo: '/images/bank-logo/kaspi.png',
      name: resolveLabel(getNestedValue(t, ['banks', 'kaspi', 'name']), 'Kaspi'),
      notes: resolveLabel(
        getNestedValue(t, ['banks', 'kaspi', 'notes']),
        'Upload Kaspi PDF statements for automatic transaction extraction.',
      ),
    },
    {
      id: 'bereke',
      logo: '/images/bank-logo/bereke-bank.png',
      name: resolveLabel(getNestedValue(t, ['banks', 'bereke', 'name']), 'Bereke'),
      notes: resolveLabel(
        getNestedValue(t, ['banks', 'bereke', 'notes']),
        'Upload Bereke PDF statements for automatic transaction extraction.',
      ),
    },
  ];

  return (
    <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pt: 'var(--lumio-page-top, 32px)', pb: 4 }}>
      <Box
        sx={{
          border: '1px solid var(--border-color)',
          bgcolor: 'background.paper',
          p: { xs: 2.5, sm: 3 },
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <Box>
          <Chip
            icon={<CheckCircle2 size={14} />}
            label={resolveLabel(getNestedValue(t, ['parserStatus']), 'Parser is active')}
            size="small"
            sx={{
              bgcolor: 'var(--color-success-soft-bg)',
              color: 'var(--color-success-soft-text)',
              border: '1px solid var(--color-success-soft-border)',
              fontWeight: 600,
              borderRadius: tokens.radius.full,
            }}
          />
        </Box>
      </Box>

      <Box
        sx={{
          mt: 3,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        }}
      >
        {banks.map(bank => (
          <Box
            component="article"
            key={bank.id}
            data-supported-bank={bank.id}
            sx={{
              border: '1px solid var(--border-color)',
              bgcolor: 'background.paper',
              p: { xs: 2.5, sm: 3 },
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  bgcolor: 'var(--muted)',
                }}
              >
                <Image
                  src={bank.logo}
                  alt={bank.name}
                  width={32}
                  height={32}
                  style={{ objectFit: 'contain' }}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
                  {bank.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--muted-foreground)' }}>
                  {resolveLabel(getNestedValue(t, ['statusLabel']), 'Status')}:{' '}
                  {resolveLabel(getNestedValue(t, ['supported']), 'Supported')}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                mt: 2,
                border: '1px solid var(--border-color)',
                // A hardcoded near-white fill left white text on a light box in
                // dark mode; the muted token follows the theme.
                bgcolor: 'var(--muted)',
                px: 1.5,
                py: 1,
                fontSize: 14,
                color: 'var(--foreground)',
              }}
            >
              <Box component="span" sx={{ fontWeight: 500, color: 'var(--foreground)', mr: 0.5 }}>
                {resolveLabel(getNestedValue(t, ['formatsLabel']), 'Supported format')}:
              </Box>
              {resolveLabel(getNestedValue(t, ['pdfStatements']), 'PDF statements')}
            </Box>

            <Typography variant="body2" sx={{ mt: 1.5, color: 'var(--text-secondary)' }}>
              {bank.notes}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="body2" sx={{ mt: 3, fontWeight: 500, color: 'var(--muted-foreground)' }}>
        {resolveLabel(getNestedValue(t, ['comingSoon']), 'More banks are coming soon')}
      </Typography>
    </Box>
  );
}
