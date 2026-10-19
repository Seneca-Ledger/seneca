'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { X } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

type ActiveRouteFilterProps = {
  label: string;
  resetLabel: string;
  onReset: () => void;
};

export function ActiveRouteFilter({
  label,
  resetLabel,
  onReset,
}: ActiveRouteFilterProps): React.JSX.Element {
  const t = useIntlayer('statementFilterControls');
  return (
    <Box
      sx={{
        border: '1px solid color-mix(in srgb, var(--primary) 22%, transparent)',
        borderRadius: tokens.radius.md,
        bgcolor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
        px: 2,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {t.category}
        </Typography>
        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700 }}>
          {label}
        </Typography>
      </Box>
      <IconButton
        type="button"
        size="small"
        aria-label={`${resetLabel}: ${label}`}
        onClick={onReset}
      >
        <X size={18} />
      </IconButton>
    </Box>
  );
}
