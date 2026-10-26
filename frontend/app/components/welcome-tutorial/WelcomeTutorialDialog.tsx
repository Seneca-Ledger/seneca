'use client';

import Dialog from '@mui/material/Dialog';
import type React from 'react';
import { useState } from 'react';
import { TutorialStepView } from './TutorialStepView';
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
 * The guide: one page per sidebar page, over the whole screen. Opened on a single
 * page, it shows that page alone until the person asks for the whole guide.
 */
export default function WelcomeTutorialDialog({
  open,
  page = null,
  onClose,
}: WelcomeTutorialDialogProps): React.JSX.Element | null {
  const steps = useTutorialSteps();
  const pageIndex = steps.findIndex(step => step.id === page);
  const [single, setSingle] = useState(pageIndex >= 0);
  const pager = useTutorialPager(steps.length, Math.max(pageIndex, 0));
  // Closing by a stray click beside the guide would lose the page it was on.
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
      fullScreen
      maxWidth={false}
      aria-labelledby={TITLE_ID}
      onKeyDown={single ? undefined : pager.onKeyDown}
      slotProps={{ paper: { sx: paperSx } }}
    >
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
