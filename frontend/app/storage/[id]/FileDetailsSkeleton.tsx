import { Box, Typography } from '@mui/material';
import Skeleton from '@mui/material/Skeleton';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { ArrowLeft, Download, RefreshCcw } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

const PANEL_SX = { border: '1px solid var(--border-color)', bgcolor: 'background.paper' } as const;
const BUTTON_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  border: '1px solid var(--border-color)',
  bgcolor: 'background.paper',
  fontWeight: 600,
  color: 'var(--foreground)',
  '&:disabled': { opacity: 0.6 },
} as const;
// Bare buttons get the md radius from the global stylesheet; these stand-ins match it.
const TAB_SX = {
  px: 2,
  py: 1,
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
  borderRadius: tokens.radius.md,
} as const;

/**
 * The file page while the file loads: its buttons, card labels, preview frame
 * and tabs for real, placeholders where the file's own values go.
 */
export function FileDetailsSkeleton(): React.JSX.Element {
  const router = useRouter();
  const t = useIntlayer('storageDetailsPage');
  const cards = [t.cards.size, t.cards.transactions, t.cards.uploadedAt, t.cards.account];
  const tabs = [t.tabs.transactions, t.tabs.links, t.tabs.permissions];

  return (
    <Box
      className="container-shared"
      aria-busy="true"
      sx={{ px: 2, py: 4, display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          alignItems: { sm: 'center' },
          justifyContent: { sm: 'space-between' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box
            component="button"
            type="button"
            onClick={() => router.push('/statements')}
            aria-label={t.actions.backToStorage.value}
            sx={{
              borderRadius: tokens.radius.full,
              border: '1px solid var(--border-color)',
              bgcolor: 'background.paper',
              p: 1,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft style={{ width: 20, height: 20 }} />
          </Box>
          <Box>
            <Skeleton variant="text" width={240} height={30} />
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              {[56, 80, 40, 64].map(width => (
                <Skeleton
                  key={width}
                  variant="rounded"
                  width={width}
                  height={24}
                  sx={{ borderRadius: tokens.radius.sm }}
                />
              ))}
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="button"
            type="button"
            disabled
            sx={{ ...BUTTON_SX, px: 1.5, py: 1, fontSize: 14 }}
          >
            <Download style={{ width: 16, height: 16 }} />
            {t.actions.download}
          </Box>
          <Skeleton
            variant="rounded"
            width={84}
            height={38}
            sx={{ borderRadius: tokens.radius.md }}
          />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1.4fr' } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: 1.5,
          }}
        >
          {cards.map(label => (
            <Box key={label.value} sx={{ ...PANEL_SX, p: 2 }}>
              <Typography
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--muted-foreground)',
                }}
              >
                {label}
              </Typography>
              <Skeleton variant="text" width={110} height={30} style={{ marginTop: 4 }} />
            </Box>
          ))}
        </Box>

        <Box sx={{ ...PANEL_SX, p: 2 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RefreshCcw style={{ width: 16, height: 16, color: 'var(--primary)' }} />
              <Typography style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                {t.preview.title}
              </Typography>
            </Box>
            <Box
              component="button"
              type="button"
              disabled
              sx={{ ...BUTTON_SX, px: 1.5, py: 0.75, fontSize: 12 }}
            >
              <RefreshCcw style={{ width: 16, height: 16 }} />
              {t.preview.refresh}
            </Box>
          </Box>
          <Box sx={{ mt: 1.5, overflow: 'hidden', border: '1px dashed var(--border-color)' }}>
            <Skeleton variant="rectangular" height={420} />
          </Box>
        </Box>
      </Box>

      <Box sx={PANEL_SX}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid var(--muted)',
            px: 2,
            py: 1.5,
          }}
        >
          {tabs.map((label, index) => (
            <Box
              key={label.value}
              component="span"
              sx={{
                ...TAB_SX,
                bgcolor: index === 0 ? 'primary.main' : 'var(--muted)',
                color: index === 0 ? 'var(--primary-foreground)' : 'var(--foreground)',
              }}
            >
              {label}
            </Box>
          ))}
        </Box>
        <Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>
          <Skeleton variant="rounded" height={36} sx={{ borderRadius: tokens.radius.md }} />
          <Skeleton variant="rectangular" height={200} />
        </Box>
      </Box>
    </Box>
  );
}
