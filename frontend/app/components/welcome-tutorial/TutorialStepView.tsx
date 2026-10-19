'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useEffect } from 'react';
import { useIntlayer } from '@/app/i18n';
import { TutorialFooter } from './TutorialFooter';
import { TutorialFragments } from './TutorialFragments';
import { useFocusTitleOnMount } from './useFocusTitleOnMount';
import type { TutorialPager } from './useTutorialPager';
import { enterSx, focusableTitleSx, TITLE_ID } from './welcome-tutorial.styles';
import {
  bodySx,
  demoNoteSx,
  descriptionSx,
  eyebrowSx,
  taglineSx,
} from './welcome-tutorial-step.styles';
import type { TutorialStep } from './welcome-tutorial-steps';

interface TutorialStepViewProps {
  steps: TutorialStep[];
  pager: TutorialPager;
  /** One page on its own: no page turning, just "Done" and a way into the whole guide. */
  single: boolean;
  onWholeGuide: () => void;
  onClose: () => void;
}

/**
 * A page turned by an arrow key takes the focused heading away with the old page, and
 * the next key would land outside the dialog. The new heading takes the focus instead.
 */
function useKeepFocusOnPageTurn(): void {
  useEffect(() => {
    if (document.activeElement === document.body) {
      document.getElementById(TITLE_ID)?.focus();
    }
  }, []);
}

function StepText({ step }: { step: TutorialStep }): React.JSX.Element {
  const { steps } = useIntlayer('welcomeTutorialSteps');
  const text = steps[step.id];
  useKeepFocusOnPageTurn();
  return (
    <>
      <Box sx={eyebrowSx}>
        {step.icon}
        {step.label}
      </Box>
      <Typography id={TITLE_ID} component="h2" tabIndex={-1} sx={[taglineSx, focusableTitleSx]}>
        {text.tagline}
      </Typography>
      <Typography sx={descriptionSx}>{text.description}</Typography>
    </>
  );
}

/** One sidebar page: what it is for, and its main parts as numbered screenshots. */
export function TutorialStepView({
  steps,
  pager,
  single,
  onWholeGuide,
  onClose,
}: TutorialStepViewProps): React.JSX.Element {
  const { controls } = useIntlayer('welcomeTutorial');
  // Once, when the guide opens; Next and the dots keep their own focus after that.
  useFocusTitleOnMount();
  const step = steps[pager.index];
  return (
    <>
      <Box key={step.id} sx={[bodySx, enterSx]}>
        <StepText step={step} />
        <TutorialFragments step={step} />
        <Typography sx={demoNoteSx}>{controls.demoNote}</Typography>
      </Box>
      <TutorialFooter
        single={single}
        onWholeGuide={onWholeGuide}
        steps={steps}
        current={pager.index}
        onBack={pager.back}
        onNext={pager.next}
        onSelect={pager.goTo}
        onClose={onClose}
      />
    </>
  );
}
