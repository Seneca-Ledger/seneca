'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { tokens } from '@/lib/theme-tokens';
import { STOIC_CLASSES } from '../hooks/useStoicBalance';
import { useClassText } from '../hooks/useStoicClassText';

/** Rows the classify list usually shows before its fold. */
const CLASSIFY_ROWS = 7;

/**
 * The Stoic balance card while it loads: its titles, the class tiles and the
 * classify list in place, with bars and figures as placeholders.
 */
export function StoicBalanceSkeleton(): React.JSX.Element {
  const { t, names, hints } = useClassText();
  return (
    <Box
      component="section"
      aria-busy
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: tokens.radius.lg,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {t.stoicTitle.value}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: 30 }}>
          <Skeleton variant="text" width={120} height={20} sx={{ mx: 4.25 }} />
        </Box>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {t.stoicSubtitle.value}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
        {[t.planned.value, t.actual.value].map(label => (
          <Box
            key={label}
            sx={{
              display: 'grid',
              gridTemplateColumns: '72px 1fr',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {label}
            </Typography>
            <Skeleton variant="rounded" height={8} sx={{ borderRadius: '4px' }} />
          </Box>
        ))}
      </Box>

      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          mb: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        {STOIC_CLASSES.map(stoicClass => (
          <Box
            component="li"
            key={stoicClass}
            sx={{ p: 1.5, borderRadius: tokens.radius.md, bgcolor: 'var(--surface-soft)' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Skeleton variant="circular" width={10} height={10} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {names[stoicClass]}
              </Typography>
            </Box>
            <Typography
              component="p"
              sx={{ color: 'text.secondary', mt: 0.5, fontSize: 13, lineHeight: 1.45 }}
            >
              {hints[stoicClass]}
            </Typography>
            <Skeleton variant="text" width={150} height={20} sx={{ mt: 0.75 }} />
          </Box>
        ))}
      </Box>

      <Box sx={{ maxWidth: 720 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {t.classifyTitle.value}
        </Typography>
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 1 }}>
          {t.classifyHint.value}
        </Typography>
        {Array.from({ length: CLASSIFY_ROWS }, (_, index) => (
          <Box
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              py: 0.75,
            }}
          >
            <Skeleton variant="text" width={140} height={20} />
            <Skeleton
              variant="rounded"
              width={180}
              height={34}
              sx={{ borderRadius: tokens.radius.sm }}
            />
          </Box>
        ))}
        <Skeleton variant="text" width={220} height={20} sx={{ mt: 1 }} />
      </Box>
    </Box>
  );
}
