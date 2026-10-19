'use client';

import Box from '@mui/material/Box';
import { ForecastContent } from './components/ForecastContent';

export default function ForecastPage() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: 'calc(100vh - var(--global-nav-height,0px))',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ForecastContent />
    </Box>
  );
}
