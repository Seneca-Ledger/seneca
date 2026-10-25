/**
 * Tour progress indicator component
 */

'use client';

import { Box, LinearProgress, Typography } from '@mui/material';
import { useIntlayer } from '@/app/i18n';

interface TourProgressProps {
  current: number;
  total: number;
  className?: string;
}

export function TourProgress({ current, total, className = '' }: TourProgressProps) {
  const t = useIntlayer('tourControls');
  const progress = (current / total) * 100;

  return (
    <Box className={className} sx={{ width: '100%', maxWidth: 300 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          {t.tourProgress}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
          }}
        >
          {current}/{total}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 6,
          backgroundColor: 'action.hover',
        }}
      />
    </Box>
  );
}
