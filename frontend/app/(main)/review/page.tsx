'use client';

import Box from '@mui/material/Box';
import { Suspense, useEffect, useState } from 'react';
import { ReviewInboxView } from './components/ReviewInboxView';
import { useReviewInbox } from './hooks/useReviewInbox';

function ReviewInboxPageContent() {
  const state = useReviewInbox();
  // Rendered after mount only: content inside Suspense hydrates once the
  // providers have switched MUI to the dark palette, so server HTML (light)
  // and client markup would disagree and React keeps the light classes.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <ReviewInboxView state={state} /> : null;
}

export default function ReviewInboxPage() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: 'calc(100vh - var(--global-nav-height,0px))',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* useSearchParams needs a Suspense boundary for static rendering. */}
      <Suspense fallback={null}>
        <ReviewInboxPageContent />
      </Suspense>
    </Box>
  );
}
