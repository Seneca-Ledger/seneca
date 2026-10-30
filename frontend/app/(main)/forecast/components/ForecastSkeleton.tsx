'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useIntlayer } from '@/app/i18n';
import type { ForecastScenario } from '../hooks/useForecast';
import { FORECAST_CARD_SX, Kpi } from './ForecastKpi';
import { ForecastUpcomingHeader, fill } from './ForecastUpcomingHeader';

const ROW_KEYS = ['row-0', 'row-1', 'row-2', 'row-3', 'row-4', 'row-5'];

/**
 * The forecast while it loads: the cards, labels and scenario strip in place,
 * the figures, curve and upcoming rows as bars.
 */
export function ForecastSkeleton({
  horizon,
  scenario,
  setFactor,
}: {
  horizon: number;
  scenario: ForecastScenario;
  setFactor: (key: 'incomeFactor' | 'expenseFactor', value: number) => void;
}) {
  const t = useIntlayer('forecastPage');
  const figure = <Skeleton variant="text" width={110} />;
  return (
    <Box aria-busy sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 2,
        }}
      >
        {/* The first card is runway or safe-to-spend, by the workspace's profile. */}
        <Kpi
          label={<Skeleton variant="text" width={80} />}
          value={figure}
          note={<Skeleton variant="text" width={140} />}
        />
        <Kpi
          label={t.lowestBalance.value}
          value={figure}
          note={<Skeleton variant="text" width={80} />}
        />
        <Kpi label={fill(t.closingBalance.value, { days: String(horizon) })} value={figure} />
      </Box>

      <Box sx={FORECAST_CARD_SX}>
        <Box sx={{ mb: 2, display: 'grid', gap: 0.25 }}>
          <Skeleton variant="text" width="40%" sx={{ fontSize: 13 }} />
          <Skeleton variant="text" width="50%" sx={{ fontSize: 13 }} />
        </Box>
        <div className="seneca-chart__box">
          <Skeleton variant="rounded" height="100%" />
        </div>
        <div className="seneca-chart__footer">
          <Skeleton variant="text" width={90} />
          <Skeleton variant="text" width={90} />
        </div>
      </Box>

      <Box sx={FORECAST_CARD_SX}>
        <ForecastUpcomingHeader scenario={scenario} setFactor={setFactor} />
        <Typography
          component="h3"
          variant="caption"
          sx={{
            display: 'block',
            color: 'text.secondary',
            pb: 0.75,
            mb: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {t.thisWeek}
        </Typography>
        {ROW_KEYS.map(key => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
            <Box sx={{ width: 28, height: 28, display: 'grid', placeItems: 'center' }}>
              <Skeleton variant="rounded" width={16} height={16} sx={{ borderRadius: 0.5 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2">
                <Skeleton variant="text" width="30%" />
              </Typography>
              <Typography variant="caption" component="div">
                <Skeleton variant="text" width="20%" />
              </Typography>
            </Box>
            <Typography variant="body2">
              <Skeleton variant="text" width={64} />
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
