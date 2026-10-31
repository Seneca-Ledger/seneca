'use client';

import Box from '@mui/material/Box';
import { useRef, useState } from 'react';

const SWIPE_THRESHOLD_PX = 80;

/** Right past the threshold approves, left skips; anything shorter snaps back. */
export function SwipeableRow({
  children,
  disabled,
  onApprove,
  onSkip,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onApprove: () => void;
  onSkip: () => void;
}) {
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  return (
    <Box
      data-testid="swipe-row"
      onTouchStart={event => {
        if (disabled) return;
        startX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchMove={event => {
        if (startX.current === null) return;
        setDx((event.touches[0]?.clientX ?? startX.current) - startX.current);
      }}
      onTouchEnd={() => {
        if (startX.current === null) return;
        if (dx > SWIPE_THRESHOLD_PX) onApprove();
        else if (dx < -SWIPE_THRESHOLD_PX) onSkip();
        startX.current = null;
        setDx(0);
      }}
      sx={{
        transform: `translateX(${dx}px)`,
        transition: dx === 0 ? 'transform 150ms ease-out' : 'none',
        bgcolor:
          dx > SWIPE_THRESHOLD_PX
            ? 'var(--color-success-soft-bg, transparent)'
            : dx < -SWIPE_THRESHOLD_PX
              ? 'action.hover'
              : 'transparent',
      }}
    >
      {children}
    </Box>
  );
}
