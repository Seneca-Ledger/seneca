import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useIntlayer } from '@/app/i18n';
import type { ForecastData } from '../hooks/useForecast';

const NOTE = {
  shortHistory: 'caveatShortHistory',
  noEverydaySpending: 'caveatNoEverydaySpending',
  derivedBalance: 'caveatDerivedBalance',
} as const;

/**
 * Says the forecast is rough when what it stands on is thin, so a confident
 * runway is not taken at its word: an ochre dot, a title and one line per reason.
 */
export function ForecastCaveats({
  caveats,
  monthsObserved,
}: Pick<ForecastData, 'caveats' | 'monthsObserved'>) {
  const t = useIntlayer('forecastPage');
  if (caveats.length === 0) return null;
  return (
    <Box role="note" sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline' }}>
      <Box
        aria-hidden
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: 'var(--attention)',
          transform: 'translateY(-1px)',
        }}
      />
      <Box sx={{ display: 'grid', gap: 0.25 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{t.caveatsTitle}</Typography>
        {caveats.map(caveat => (
          <Typography key={caveat} sx={{ fontSize: 13, color: 'text.secondary' }}>
            {t[NOTE[caveat]].value.replaceAll('{{months}}', String(monthsObserved))}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
