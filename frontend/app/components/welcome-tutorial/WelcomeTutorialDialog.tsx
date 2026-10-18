'use client';

import Dialog from '@mui/material/Dialog';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type React from 'react';
import { SidebarRing } from './SidebarRing';
import { spotlightClipPath } from './sidebar-spot';
import { TutorialStepView } from './TutorialStepView';
import { useSidebarSpot } from './useSidebarSpot';
import { useTutorialPager } from './useTutorialPager';
import { useTutorialSteps } from './useTutorialSteps';
import { paperSx, TITLE_ID } from './welcome-tutorial.styles';

interface WelcomeTutorialDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The guide: one page per sidebar page, opened on demand. The sidebar item of the page
 * on show is lit through the backdrop and ringed, and the guide sits beside the sidebar.
 */
// eslint-disable-next-line max-lines-per-function -- the dialog and its slots in one place
export default function WelcomeTutorialDialog({
  open,
  onClose,
}: WelcomeTutorialDialogProps): React.JSX.Element | null {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('md'));
  const steps = useTutorialSteps();
  const pager = useTutorialPager(steps.length);
  const spot = useSidebarSpot(steps[pager.index]?.path);
  // Closing by a stray click beside the guide would lose the page it was on.
  // eslint-disable-next-line max-params -- MUI's onClose signature
  const handleClose = (_event: object, reason: 'backdropClick' | 'escapeKeyDown'): void => {
    if (reason !== 'backdropClick') {
      onClose();
    }
  };
  // Permissions still loading: no page to show yet.
  if (steps.length === 0) {
    return null;
  }
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth={false}
      aria-labelledby={TITLE_ID}
      onKeyDown={pager.onKeyDown}
      slotProps={{
        backdrop: { sx: { clipPath: spotlightClipPath(spot) } },
        paper: {
          sx: paperSx,
          style: { '--guide-inset': `${spot.inset}px` } as React.CSSProperties,
        },
      }}
    >
      {spot.item ? <SidebarRing key={steps[pager.index].path} rect={spot.item} /> : null}
      <TutorialStepView steps={steps} pager={pager} onClose={onClose} />
    </Dialog>
  );
}
