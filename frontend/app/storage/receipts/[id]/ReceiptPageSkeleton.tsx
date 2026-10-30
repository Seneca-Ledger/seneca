import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { ArrowLeft } from '@/app/components/icons';
import { DetailActionButton } from '@/app/components/ui/detail-action-button';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

const FIELD_KEYS = ['vendor', 'date', 'amount', 'currency', 'category', 'tax'];

/**
 * The receipt page while the receipt loads: the back link, the buttons and
 * the two columns with their titles, placeholders where the receipt's values go.
 * Theme variables throughout: the page's resolved palette is light until the theme resolves.
 */
export function ReceiptPageSkeleton(): React.JSX.Element {
  const router = useRouter();
  const t = useIntlayer('receiptDocumentPage');
  return (
    <Box
      className="container-shared"
      aria-busy="true"
      sx={{
        height: '100%',
        overflowY: { xs: 'auto', xl: 'hidden' },
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 2, sm: 3, lg: 4 },
        py: { xs: 4, xl: 2.5 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          gap: { xs: 3, xl: 2 },
          flex: { xl: 1 },
          minHeight: { xl: 0 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            borderBottom: '1px solid var(--border)',
            pb: { xs: 3, xl: 2 },
            flexShrink: 0,
            alignItems: { sm: 'center' },
            justifyContent: { sm: 'space-between' },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              component="button"
              type="button"
              onClick={() => router.back()}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                p: 0,
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t.back}
            </Box>
            <Box>
              <Typography
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: 'var(--text-muted)',
                }}
              >
                {t.eyebrow}
              </Typography>
              <Skeleton variant="text" width={320} height={36} style={{ marginTop: 4 }} />
              <Skeleton variant="text" width={200} height={20} style={{ marginTop: 4 }} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <DetailActionButton variant="ghost" type="button" disabled>
              {t.markAsSubscription}
            </DetailActionButton>
            <DetailActionButton variant="ghost" type="button" disabled>
              {t.download}
            </DetailActionButton>
            <DetailActionButton variant="ghost" type="button" disabled>
              {t.exportToTable}
            </DetailActionButton>
            <DetailActionButton variant="default" type="button" disabled>
              {t.approve}
            </DetailActionButton>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            alignItems: 'stretch',
            gap: { xs: 3, xl: 2.5 },
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) minmax(0, 1fr)' },
            gridTemplateRows: { xl: 'minmax(0, 1fr)' },
            flex: { xl: 1 },
            minHeight: { xl: 0 },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              height: '100%',
              minHeight: { xs: 420, xl: 0 },
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ borderBottom: '1px solid var(--border)', px: 2.5, py: 2 }}>
              <Typography style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                {t.originalDocument}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, p: 2, bgcolor: 'var(--surface-soft)' }}>
              <Skeleton variant="rectangular" height="100%" sx={{ minHeight: 360 }} />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, px: { xl: 1 } }}>
            <Box sx={{ borderBottom: '1px solid var(--border)', pb: 1.5 }}>
              <Typography style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                {t.parsedFields}
              </Typography>
              <Typography style={{ marginTop: 2, fontSize: 13, color: 'var(--text-muted)' }}>
                {t.parsedFieldsHint}
              </Typography>
            </Box>
            {FIELD_KEYS.map(key => (
              <Box key={key}>
                <Skeleton variant="text" width={90} height={18} />
                <Skeleton variant="rounded" height={40} sx={{ borderRadius: tokens.radius.sm }} />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
