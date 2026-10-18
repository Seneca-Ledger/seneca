'use client';

import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
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
  badgeSx,
  bentoSx,
  captionNumberSx,
  captionSx,
  captionsSx,
  captionTextSx,
  captionTitleSx,
  fragmentAreaSx,
  frameCellSx,
  frameSlotSx,
  frameSx,
  pairSx,
  scrollerSx,
  scrollItemSx,
} from './welcome-tutorial-step.styles';
import type { TutorialStep } from './welcome-tutorial-steps';

interface FragmentProps {
  step: TutorialStep;
  fragment: TutorialFragment;
  number: number;
  /** Fills a cell of the desktop grid instead of keeping the screenshot's proportions. */
  fill?: boolean;
}

interface CaptionText {
  title: React.ReactNode & { value: string };
  text: React.ReactNode;
}

// Rendered widths of each frame, so the optimizer serves a fitting size.
const SIZES = {
  hero: '(max-width: 899px) 86vw, 55vw',
  side: '(max-width: 899px) 86vw, 38vw',
  pair: '(max-width: 899px) 86vw, 46vw',
} as const;

function useCaption({ step, fragment }: Omit<FragmentProps, 'number'>): CaptionText {
  const { steps } = useIntlayer('welcomeTutorialSteps');
  return (steps[step.id].fragments as unknown as Record<string, CaptionText>)[fragment.id];
}

/**
 * The screenshot in the user's language; a language whose screenshots are not generated
 * yet answers 404, and the frame then shows the English one instead (once, no retry loop).
 */
function useScreenUrl({ step, fragment }: Omit<FragmentProps, 'number'>): {
  url: string;
  onError: () => void;
} {
  const { locale } = useLocale();
  const mode = useTheme().palette.mode;
  const [fallback, setFallback] = useState(false);
  const url = tutorialScreenUrl({
    locale: fallback ? FALLBACK_SCREENS_LOCALE : String(locale),
    stepId: step.id,
    fragmentId: fragment.id,
    mode,
  });
  const onError = (): void => setFallback(true);
  return { url, onError };
}

function FragmentFrame({ step, fragment, number, fill = false }: FragmentProps): React.JSX.Element {
  const caption = useCaption({ step, fragment });
  const { url, onError } = useScreenUrl({ step, fragment });
  const frame = (
    <Box sx={frameSlotSx(FRAME_ASPECT[fragment.frame], fill)}>
      <Box sx={frameSx}>
        <Image
          src={url}
          alt={caption.title.value}
          fill
          sizes={SIZES[fragment.frame]}
          onError={onError}
          style={{ objectFit: 'cover', objectPosition: 'top left' }}
        />
      </Box>
      <Box sx={badgeSx} aria-hidden>
        {number}
      </Box>
    </Box>
  );
  return fill ? <Box sx={frameCellSx}>{frame}</Box> : frame;
}

function FragmentCaption({ step, fragment, number }: FragmentProps): React.JSX.Element {
  const caption = useCaption({ step, fragment });
  return (
    <Box sx={captionSx}>
      <Box sx={captionNumberSx} aria-hidden>
        {number}
      </Box>
      <Box>
        <Typography sx={captionTitleSx}>{caption.title}</Typography>
        <Typography sx={captionTextSx}>{caption.text}</Typography>
      </Box>
    </Box>
  );
}

/** Desktop: the frames side by side (one large and two small, or a pair), captions below. */
function FragmentGrid({ step }: { step: TutorialStep }): React.JSX.Element {
  const fragments = [...step.fragments.entries()].map(([index, fragment]) => ({
    step,
    fragment,
    number: index + 1,
  }));
  return (
    <Box sx={fragmentAreaSx}>
      <Box sx={fragments.length === 3 ? bentoSx : pairSx}>
        {fragments.map(props => (
          <FragmentFrame key={props.fragment.id} {...props} fill />
        ))}
      </Box>
      <Box sx={captionsSx(fragments.length)}>
        {fragments.map(props => (
          <FragmentCaption key={props.fragment.id} {...props} />
        ))}
      </Box>
    </Box>
  );
}

/** Small screens: one frame at a time in a swipeable row, each with its caption. */
function FragmentScroller({ step }: { step: TutorialStep }): React.JSX.Element {
  return (
    <Box sx={scrollerSx}>
      {[...step.fragments.entries()].map(([index, fragment]) => (
        <Box key={fragment.id} sx={scrollItemSx}>
          <FragmentFrame step={step} fragment={fragment} number={index + 1} />
          <Box sx={{ mt: 1.5 }}>
            <FragmentCaption step={step} fragment={fragment} number={index + 1} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function TutorialFragments({ step }: { step: TutorialStep }): React.JSX.Element {
  const compact = useMediaQuery(useTheme().breakpoints.down('md'));
  return compact ? <FragmentScroller step={step} /> : <FragmentGrid step={step} />;
}
