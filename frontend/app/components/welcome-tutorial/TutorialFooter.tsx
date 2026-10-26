'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type React from 'react';
import { ChevronLeft, ChevronRight } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import {
  closeButtonSx,
  directionalIconSx,
  dotSx,
  dotsSx,
  footerActionsSx,
  footerSx,
} from './welcome-tutorial.styles';
import type { TutorialStep } from './welcome-tutorial-steps';

interface TutorialFooterProps {
  single: boolean;
  onWholeGuide: () => void;
  steps: TutorialStep[];
  current: number;
  onBack: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
  onClose: () => void;
}

const BackIcon = (
  <Box component="span" sx={directionalIconSx}>
    <ChevronLeft size={18} />
  </Box>
);

const NextIcon = (
  <Box component="span" sx={directionalIconSx}>
    <ChevronRight size={18} />
  </Box>
);

/** One dot per page; each one jumps to its page. The group reads "Step 3 of 13". */
function StepDots({
  steps,
  current,
  onSelect,
}: Pick<TutorialFooterProps, 'steps' | 'current' | 'onSelect'>): React.JSX.Element {
  const { controls } = useIntlayer('welcomeTutorial');
  const label = controls.progress.value
    .replace('{{current}}', String(current + 1))
    .replace('{{total}}', String(steps.length));
  return (
    <Box role="group" aria-label={label} sx={dotsSx}>
      {[...steps.entries()].map(([index, step]) => (
        <Box
          key={step.id}
          component="button"
          type="button"
          aria-label={step.title}
          aria-current={index === current ? 'step' : undefined}
          title={step.title}
          onClick={() => onSelect(index)}
          sx={dotSx(index === current)}
        />
      ))}
    </Box>
  );
}

/** One page on its own: the way into the whole guide, and Done. */
function SingleFooter({
  onWholeGuide,
  onClose,
}: Pick<TutorialFooterProps, 'onWholeGuide' | 'onClose'>): React.JSX.Element {
  const { controls } = useIntlayer('welcomeTutorial');
  return (
    <Box component="footer" sx={footerSx}>
      <Button variant="text" onClick={onWholeGuide} sx={closeButtonSx}>
        {controls.wholeGuide}
      </Button>
      <Box sx={footerActionsSx}>
        <Button variant="contained" onClick={onClose}>
          {controls.finish}
        </Button>
      </Box>
    </Box>
  );
}

export function TutorialFooter({
  single,
  onWholeGuide,
  steps,
  current,
  onBack,
  onNext,
  onSelect,
  onClose,
}: TutorialFooterProps): React.JSX.Element {
  const { controls } = useIntlayer('welcomeTutorial');
  const last = current === steps.length - 1;
  if (single) {
    return <SingleFooter onWholeGuide={onWholeGuide} onClose={onClose} />;
  }
  return (
    <Box component="footer" sx={footerSx}>
      <Button variant="text" onClick={onClose} sx={closeButtonSx}>
        {controls.close}
      </Button>
      <StepDots steps={steps} current={current} onSelect={onSelect} />
      <Box sx={footerActionsSx}>
        <Button variant="outlined" onClick={onBack} disabled={current === 0} startIcon={BackIcon}>
          {controls.back}
        </Button>
        {/* The last page has nowhere to go next: the same button closes the guide. */}
        <Button
          variant="contained"
          onClick={last ? onClose : onNext}
          endIcon={last ? null : NextIcon}
        >
          {last ? controls.finish : controls.next}
        </Button>
      </Box>
    </Box>
  );
}
