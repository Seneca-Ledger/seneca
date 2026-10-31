'use client';

import ThumbDown from '@mui/icons-material/ThumbDown';
import ThumbDownOutlined from '@mui/icons-material/ThumbDownOutlined';
import ThumbUp from '@mui/icons-material/ThumbUp';
import ThumbUpOutlined from '@mui/icons-material/ThumbUpOutlined';
import IconButton from '@mui/material/IconButton';
import { type QuoteVote, useQuoteVote } from '@/app/hooks/useDailyQuote';
import { useIntlayer } from '@/app/i18n';

const ICON = { fontSize: 16 } as const;

/**
 * Thumbs up and down on the quote of the day: more or fewer quotes like it.
 * Pressing the thumb already down takes it back.
 */
export function QuoteThumbs({
  quoteId,
  vote,
}: {
  quoteId: string;
  vote: QuoteVote;
}): React.JSX.Element {
  const t = useIntlayer('insights');
  const voteQuote = useQuoteVote();
  const press = (thumb: 1 | -1): void => voteQuote(quoteId, vote === thumb ? null : thumb);

  return (
    <>
      <IconButton
        size="small"
        aria-label={t.quoteMore.value}
        aria-pressed={vote === 1}
        title={t.quoteMore.value}
        onClick={() => press(1)}
        sx={{ color: 'text.secondary' }}
      >
        {vote === 1 ? (
          <ThumbUp sx={{ ...ICON, color: 'success.main' }} />
        ) : (
          <ThumbUpOutlined sx={ICON} />
        )}
      </IconButton>
      <IconButton
        size="small"
        aria-label={t.quoteLess.value}
        aria-pressed={vote === -1}
        title={t.quoteLess.value}
        onClick={() => press(-1)}
        sx={{ color: 'text.secondary' }}
      >
        {vote === -1 ? (
          <ThumbDown sx={{ ...ICON, color: 'text.primary' }} />
        ) : (
          <ThumbDownOutlined sx={ICON} />
        )}
      </IconButton>
    </>
  );
}
