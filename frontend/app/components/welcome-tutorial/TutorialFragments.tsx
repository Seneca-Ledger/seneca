'use client';

import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Image from 'next/image';
import type React from 'react';
import { useState } from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import {
  FALLBACK_SCREENS_LOCALE,
  FRAME_ASPECT,
  type TutorialFragment,
  tutorialScreenUrl,
} from './welcome-tutorial-screens';
import {
  demoBadgeSx,
  pictureCellSx,
  pictureSx,
  pointsSx,
  pointTextSx,
  pointTitleSx,
} from './welcome-tutorial-step.styles';
import type { TutorialStep } from './welcome-tutorial-steps';

interface CaptionText {
  title: React.ReactNode & { value: string };
  text: React.ReactNode;
}

function useCaptions(step: TutorialStep): Record<string, CaptionText> {
  const { steps } = useIntlayer('welcomeTutorialSteps');
  return steps[step.id].fragments as unknown as Record<string, CaptionText>;
}

/**
 * The screenshot in the user's language; a language whose screenshots are not generated
 * yet answers 404, and the picture then shows the English one instead (once, no retry loop).
 */
function useScreenUrl(step: TutorialStep, fragment: TutorialFragment) {
  const { locale } = useLocale();
  const mode = useTheme().palette.mode;
  const [fallback, setFallback] = useState(false);
  const url = tutorialScreenUrl({
    locale: fallback ? FALLBACK_SCREENS_LOCALE : String(locale),
    stepId: step.id,
    fragmentId: fragment.id,
    mode,
  });
  return { url, onError: () => setFallback(true) };
}

/**
 * One recognizable picture of the page: its main part, large enough to read, marked
 * as demo data so nobody takes the figures for their own.
 */
export function TutorialPicture({ step }: { step: TutorialStep }): React.JSX.Element {
  const { controls } = useIntlayer('welcomeTutorial');
  const main = step.fragments[0];
  const caption = useCaptions(step)[main.id];
  const { url, onError } = useScreenUrl(step, main);
  return (
    <Box sx={pictureCellSx}>
      <Box sx={pictureSx(FRAME_ASPECT[main.frame])}>
        <Image
          src={url}
          alt={caption.title.value}
          fill
          sizes="(max-width: 899px) 92vw, 56vw"
          onError={onError}
          style={{ objectFit: 'cover', objectPosition: 'top left' }}
        />
        <Box component="span" sx={demoBadgeSx}>
          {controls.demoBadge}
        </Box>
      </Box>
    </Box>
  );
}

/** What is on the page, as a plain list: a short title and one line each. */
export function TutorialPoints({ step }: { step: TutorialStep }): React.JSX.Element {
  const captions = useCaptions(step);
  return (
    <Box component="ul" sx={pointsSx}>
      {step.fragments.map(fragment => (
        <li key={fragment.id}>
          <Typography sx={pointTitleSx}>{captions[fragment.id].title}</Typography>
          <Typography sx={pointTextSx}>{captions[fragment.id].text}</Typography>
        </li>
      ))}
    </Box>
  );
}
