'use client';

import Dialog from '@mui/material/Dialog';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type React from 'react';
import { useState } from 'react';
import { SidebarRing } from './SidebarRing';
import { spotlightClipPath } from './sidebar-spot';
import { TutorialStepView } from './TutorialStepView';
import { useSidebarSpot } from './useSidebarSpot';
import { useTutorialPager } from './useTutorialPager';
import { useTutorialSteps } from './useTutorialSteps';
import { paperSx, TITLE_ID } from './welcome-tutorial.styles';
import type { TutorialStepId } from './welcome-tutorial-routes';

interface WelcomeTutorialDialogProps {
  open: boolean;
  /** Opened on this page alone (a first visit to it); the whole guide when absent. */
  page?: TutorialStepId | null;
  onClose: () => void;
}

/**
 * The guide: one page per sidebar page, filling the screen beside the sidebar. The
 * sidebar item of the page on show is lit through the backdrop and ringed. Opened on a
 * single page, it shows that page alone until the person asks for the whole guide.
 */
// eslint-disable-next-line max-lines-per-function -- the dialog and its slots in one place
export default function WelcomeTutorialDialog({
  open,
  page = null,
  onClose,
}: WelcomeTutorialDialogProps): React.JSX.Element | null {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('md'));
  const steps = useTutorialSteps();
  const pageIndex = steps.findIndex(step => step.id === page);
  const [single, setSingle] = useState(pageIndex >= 0);
  const pager = useTutorialPager(steps.length, Math.max(pageIndex, 0));
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
      onKeyDown={single ? undefined : pager.onKeyDown}
      slotProps={{
        backdrop: { sx: { clipPath: spotlightClipPath(spot) } },
        paper: {
          sx: paperSx,
          style: { '--guide-inset': `${spot.inset}px` } as React.CSSProperties,
        },
      }}
    >
      {spot.item ? <SidebarRing key={steps[pager.index].path} rect={spot.item} /> : null}
      <TutorialStepView
        steps={steps}
        pager={pager}
        single={single}
        onWholeGuide={() => setSingle(false)}
        onClose={onClose}
      />
    </Dialog>
  );
}
