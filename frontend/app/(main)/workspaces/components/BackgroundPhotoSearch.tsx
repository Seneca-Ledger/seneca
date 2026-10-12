'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, useEffect, useState } from 'react';
import { Search } from '@/app/components/icons';
import { FilterChipButton } from '@/app/components/ui/filter-chip-button';
import { useIntlayer } from '@/app/i18n';
import { apiBaseUrl } from '@/app/lib/api';
import { tokens } from '@/lib/theme-tokens';
import { useBackgroundSearch } from './hooks/useBackgroundSearch';

interface BackgroundPhotoSearchProps {
  disabled: boolean;
  onPick: (photoId: string) => void;
}

/**
 * The search terms are English whatever the interface language: Openverse
 * titles and tags are overwhelmingly English, so a translated term finds a
 * fraction of the pictures. Only the chip label is translated.
 */
const SUGGESTION_QUERIES = [
  'mountains',
  'fjord',
  'mountain lake',
  'aurora borealis',
  'forest',
  'coast',
] as const;

const GRID = {
  display: 'grid',
  gap: 1,
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
} as const;

/**
 * Landscape photos beyond the bundled set, searched through the API on
 * Openverse — the image search that works without a key. The first suggestion
 * runs on open so the tab is never an empty box; the server caches each page
 * for a day, so this costs the shared allowance once, not once per visit.
 */
export function BackgroundPhotoSearch({ disabled, onPick }: BackgroundPhotoSearchProps) {
  const t = useIntlayer('workspaceOverview');
  const { results, term, isPending, error, hasMore, runSearch, loadMore } = useBackgroundSearch();
  const [input, setInput] = useState('');
  // Plain strings (.value): indexing the dictionary node by a union key is
  // what trips TS2590 in this codebase.
  const suggestionLabels: Record<(typeof SUGGESTION_QUERIES)[number], string> = {
    mountains: t.background.suggestionMountains.value,
    fjord: t.background.suggestionFjords.value,
    'mountain lake': t.background.suggestionLakes.value,
    'aurora borealis': t.background.suggestionAurora.value,
    forest: t.background.suggestionForest.value,
    coast: t.background.suggestionCoast.value,
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, on open
  useEffect(() => {
    runSearch(SUGGESTION_QUERIES[0]);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (value) {
      runSearch(value);
    }
  };

  const showSkeleton = isPending && results.length === 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
        {SUGGESTION_QUERIES.map(query => (
          <FilterChipButton
            key={query}
            active={term === query}
            aria-pressed={term === query}
            onClick={() => {
              setInput('');
              runSearch(query);
            }}
          >
            {suggestionLabels[query]}
          </FilterChipButton>
        ))}
      </Box>

      <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
        <TextField
          size="small"
          fullWidth
          value={input}
          placeholder={t.background.searchPlaceholder.value}
          onChange={event => setInput(event.target.value)}
          slotProps={{
            htmlInput: { maxLength: 100, 'aria-label': t.background.searchPlaceholder.value },
          }}
        />
        <Button
          type="submit"
          variant="outlined"
          disabled={!input.trim() || isPending}
          // Height comes from the text field: no vertical padding of its own,
          // stretched to the row the field sets.
          sx={{ alignSelf: 'stretch', height: 'auto', py: 0, minHeight: 0, flexShrink: 0 }}
        >
          <Search size={18} />
          <Box component="span" sx={{ ml: 0.75 }}>
            {t.background.searchButton}
          </Box>
        </Button>
      </Box>

      {error && (
        <Typography variant="body2" color="error" sx={{ py: 1 }}>
          {error}
        </Typography>
      )}

      {showSkeleton && (
        <Box sx={GRID}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton grid
              key={index}
              variant="rounded"
              sx={{ aspectRatio: '16 / 9', height: 'auto', borderRadius: tokens.radius.md }}
            />
          ))}
        </Box>
      )}

      {results.length > 0 && (
        <>
          <Box sx={GRID}>
            {results.map(photo => (
              <Box
                key={photo.id}
                component="button"
                type="button"
                title={photo.attribution}
                aria-label={photo.title}
                disabled={disabled}
                onClick={() => onPick(photo.id)}
                sx={{
                  position: 'relative',
                  aspectRatio: '16 / 9',
                  p: 0,
                  overflow: 'hidden',
                  border: '2px solid var(--border-color)',
                  borderRadius: tokens.radius.md,
                  bgcolor: 'action.hover',
                  cursor: disabled ? 'wait' : 'pointer',
                  '&:hover .background-photo-credit, &:focus-visible .background-photo-credit': {
                    opacity: 1,
                  },
                }}
              >
                <Box
                  component="img"
                  src={`${apiBaseUrl}/workspaces/backgrounds/preview/${photo.id}`}
                  alt={photo.title}
                  // Not lazy: inside a drawer Chrome may never re-evaluate a lazy
                  // image (the same trap the goal cover picker hit), and a page
                  // is 18 small thumbnails anyway.
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {photo.creator && (
                  <Box
                    component="span"
                    className="background-photo-credit"
                    sx={{
                      position: 'absolute',
                      insetInline: 0,
                      bottom: 0,
                      px: 1,
                      py: 0.5,
                      fontSize: 11,
                      color: '#fff',
                      textAlign: 'start',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.6))',
                      opacity: 0,
                      transition: 'opacity 150ms ease',
                      '@media (hover: none)': { opacity: 1 },
                    }}
                  >
                    {photo.creator}
                  </Box>
                )}
              </Box>
            ))}
          </Box>

          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
              <Button variant="text" onClick={loadMore} disabled={isPending}>
                {t.background.showMore}
              </Button>
            </Box>
          )}

          {/* Not decoration: a CC photo may not be shown without credit, and
              this is where the person learns it will carry one. */}
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
            {t.background.licenceNote}{' '}
            <Link href="https://openverse.org" target="_blank" rel="noopener noreferrer">
              Openverse
            </Link>
          </Typography>
        </>
      )}

      {!(isPending || error) && term && results.length === 0 && (
        <Typography variant="body2" sx={{ py: 2, color: 'text.secondary' }}>
          {t.background.noResults}
        </Typography>
      )}
    </Box>
  );
}
