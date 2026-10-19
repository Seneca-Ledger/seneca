'use client';

import Box from '@mui/material/Box';
import { AlertCircle, RefreshCcw } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

type DashboardErrorBannerProps = { error: string; onRefresh: () => void };

// Quiet on purpose: the soft error tokens have dark-theme values, and only the
// small icon carries the red, so the banner does not glare on a dark page.
const REFRESH_BTN_STYLE: React.CSSProperties = {
  marginLeft: 'auto',
  display: 'inline-flex',
  padding: 6,
  borderRadius: tokens.radius.full,
  color: 'var(--muted-foreground)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};

export function DashboardErrorBanner({
  error,
  onRefresh,
}: DashboardErrorBannerProps): React.JSX.Element {
  const t = useIntlayer('dashboardPage');
  return (
    <Box sx={{ px: 8, pt: 6 }}>
      <Box
        role="alert"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
          border: '1px solid var(--color-error-soft-border)',
          borderRadius: tokens.radius.md,
          bgcolor: 'var(--color-error-soft-bg)',
          fontSize: 14,
          color: 'var(--foreground)',
        }}
      >
        <AlertCircle size={16} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
        <span>{error}</span>
        <button
          type="button"
          onClick={onRefresh}
          style={REFRESH_BTN_STYLE}
          aria-label={t.error.retry.value}
        >
          <RefreshCcw style={{ width: 16, height: 16 }} />
        </button>
      </Box>
    </Box>
  );
}
