'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Check, ChevronLeft, Search } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { apiBaseUrl } from '@/app/lib/api';
import { tokens } from '@/lib/theme-tokens';
import { useCoverSearch } from '../hooks/useCoverSearch';
import type { GoalCoverSelection } from '../hooks/useGoals';
import { GOAL_COVER_PRESETS } from '../lib/goal-cover-presets';

export interface GoalCoverPickerLabels {
  title: string;
  presets: string;
  photos: string;
  searchPlaceholder: string;
  search: string;
  noResults: string;
  searchHint: string;
  licenceNote: string;
  remove: string;
  close: string;
}

interface GoalCoverPickerProps {
  open: boolean;
  selection: GoalCoverSelection | null;
  labels: GoalCoverPickerLabels;
  onSelect: (selection: GoalCoverSelection | null) => void;
  onClose: () => void;
}

const TILE_GRID = {
  display: 'grid',
  // Narrower tiles below the breakpoint: on a 360px phone the 96px floor only
  // fits two per row, which leaves the grid looking like a list.
  gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
  gap: 1.5,
  '@media (min-width:600px)': {
    gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
  },
} as const;

/**
 * Where a goal gets its picture. The bundled tiles are the first tab because
 * they are instant and always available; the photo search goes through the API
 * to Openverse, the one image search that answers without an API key.
 *
 * A sidebar like the workspace background picker rather than a dialog: it opens
 * from the goal form drawer, and DrawerShell fades the form out underneath
 * while this one is on top, then brings it back on close.
 */
export function GoalCoverPicker({
  open,
  selection,
  labels,
  onSelect,
  onClose,
}: GoalCoverPickerProps) {
  const [tab, setTab] = useState<'presets' | 'photos'>('presets');
  const [term, setTerm] = useState('');
  const { results, isPending, error, hasSearched, runSearch } = useCoverSearch();

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = term.trim();
    if (trimmed) {
      runSearch(trimmed);
    }
  };

  const pick = (next: GoalCoverSelection) => {
    onSelect(next);
    onClose();
  };

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      position="right"
      width="lg"
      showCloseButton={false}
      sx={{
        maxWidth: '100%',
        borderLeft: 0,
        bgcolor: 'background.paper',
        '@media (min-width:600px)': { maxWidth: 512 },
      }}
      title={
        <div className="lumio-payable-drawer__title-wrap">
          <button
            type="button"
            onClick={onClose}
            className="lumio-payable-drawer__back-btn"
            aria-label={labels.close}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
            {labels.title}
          </span>
        </div>
      }
    >
      <div className="lumio-payable-drawer__body">
        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, pb: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, value: 'presets' | 'photos') => setTab(value)}
            sx={{ mb: 2 }}
          >
            <Tab value="presets" label={labels.presets} />
            <Tab value="photos" label={labels.photos} />
          </Tabs>

          {tab === 'presets' && (
            <Box sx={TILE_GRID}>
              {GOAL_COVER_PRESETS.map(preset => {
                const isSelected = selection?.kind === 'preset' && selection.preset === preset.id;
                return (
                  <Box
                    key={preset.id}
                    component="button"
                    type="button"
                    aria-label={preset.id}
                    aria-pressed={isSelected}
                    onClick={() => pick({ kind: 'preset', preset: preset.id })}
                    sx={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      border: '2px solid',
                      borderColor: isSelected ? 'primary.main' : 'transparent',
                      borderRadius: tokens.radius.md,
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff',
                      p: 0,
                      background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                    }}
                  >
                    <preset.Icon size={28} />
                    {isSelected && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          bgcolor: 'primary.main',
                          borderRadius: tokens.radius.full,
                          display: 'grid',
                          placeItems: 'center',
                          width: 20,
                          height: 20,
                        }}
                      >
                        <Check size={14} />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}

          {tab === 'photos' && (
            <>
              <Box
                component="form"
                onSubmit={submitSearch}
                sx={{ display: 'flex', gap: 1, mb: 1.5 }}
              >
                <TextField
                  size="small"
                  fullWidth
                  value={term}
                  placeholder={labels.searchPlaceholder}
                  onChange={event => setTerm(event.target.value)}
                />
                <Button
                  type="submit"
                  variant="outlined"
                  disabled={!term.trim() || isPending}
                  sx={{ alignSelf: 'stretch', height: 'auto', py: 0, minHeight: 0, flexShrink: 0 }}
                >
                  <Search size={18} />
                  <Box component="span" sx={{ ml: 0.75 }}>
                    {labels.search}
                  </Box>
                </Button>
              </Box>

              {error && (
                <Typography variant="body2" color="error" sx={{ py: 1 }}>
                  {error}
                </Typography>
              )}

              {isPending && (
                <Box sx={TILE_GRID}>
                  {Array.from({ length: 9 }).map((_, index) => (
                    <Skeleton
                      // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton grid
                      key={index}
                      variant="rounded"
                      sx={{ aspectRatio: '1 / 1', height: 'auto', borderRadius: tokens.radius.md }}
                    />
                  ))}
                </Box>
              )}

              {!(isPending || error) && results.length > 0 && (
                <>
                  <Box sx={TILE_GRID}>
                    {results.map(photo => {
                      const isSelected =
                        selection?.kind === 'photo' && selection.photoId === photo.id;
                      return (
                        <Box
                          key={photo.id}
                          component="button"
                          type="button"
                          title={photo.attribution}
                          aria-label={photo.title}
                          aria-pressed={isSelected}
                          onClick={() =>
                            pick({
                              kind: 'photo',
                              photoId: photo.id,
                              attribution: photo.attribution,
                            })
                          }
                          sx={{
                            position: 'relative',
                            aspectRatio: '1 / 1',
                            border: '2px solid',
                            borderColor: isSelected ? 'primary.main' : 'transparent',
                            borderRadius: tokens.radius.md,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            p: 0,
                            bgcolor: 'action.hover',
                          }}
                        >
                          <Box
                            component="img"
                            src={`${apiBaseUrl}/goals/covers/preview/${photo.id}`}
                            alt={photo.title}
                            // Not lazy: Chrome never re-evaluates a lazy image that was
                            // laid out inside a dialog, so the whole grid stayed
                            // blank. One page is 18 thumbnails of ~25 KB, all on screen
                            // at once, so there is nothing for lazy loading to defer.
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                  {/* Not decoration: a CC image may not be shown without naming where
              it came from, and this is where the person learns that before
              they pick one. */}
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}
                  >
                    {labels.licenceNote}{' '}
                    <Link href="https://openverse.org" target="_blank" rel="noopener noreferrer">
                      Openverse
                    </Link>
                  </Typography>
                </>
              )}

              {!(isPending || error) && hasSearched && results.length === 0 && (
                <Typography variant="body2" sx={{ py: 2, color: 'text.secondary' }}>
                  {labels.noResults}
                </Typography>
              )}

              {!(isPending || error || hasSearched) && (
                <Typography variant="body2" sx={{ py: 1, color: 'text.secondary' }}>
                  {labels.searchHint}
                </Typography>
              )}
            </>
          )}
        </Box>
        <div className="lumio-payable-drawer__footer">
          <Button
            color="error"
            sx={{ flex: 1 }}
            disabled={!selection}
            onClick={() => onSelect(null)}
          >
            {labels.remove}
          </Button>
          <Button variant="outlined" sx={{ flex: 1 }} onClick={onClose}>
            {labels.close}
          </Button>
        </div>
      </div>
    </DrawerShell>
  );
}
