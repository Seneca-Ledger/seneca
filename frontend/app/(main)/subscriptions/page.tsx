'use client';

import { Box } from '@mui/material';
import { useAttentionFocus } from '@/app/hooks/useAttentionFocus';
import { SubscriptionsContent } from './components/SubscriptionsContent';
import { useSubscriptionsPage } from './hooks/useSubscriptionsPage';

export default function SubscriptionsPage() {
  const state = useSubscriptionsPage();
  useAttentionFocus();
  return (
    <Box
      component="main"
      sx={{
        minHeight: 'calc(100vh - var(--global-nav-height,0px))',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <SubscriptionsContent {...state} />
    </Box>
  );
}
