'use client';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from 'next-themes';
import { type ChangelogEntry, ChangelogModal } from '@/app/components/ChangelogModal';
import { CalendarDays, Clock3, FileText } from '@/app/components/icons';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';

type Props = {
  tx: (path: string[], fallback: string) => string;
  locale: string | undefined;
  changelogEntries: ChangelogEntry[];
  changelogLoading: boolean;
  changelogSelectedEntry: ChangelogEntry | null;
  setChangelogSelectedEntry: (entry: ChangelogEntry | null) => void;
};

export function ChangelogSection({
  tx,
  locale,
  changelogEntries,
  changelogLoading,
  changelogSelectedEntry,
  setChangelogSelectedEntry,
}: Props) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const releaseLabelText = tx(['changelogCard', 'releaseLabel'], 'Release');
  const closeLabelText = tx(['changelogCard', 'closeLabel'], 'Close changelog');
  const emptyText = tx(['changelogCard', 'empty'], 'No published updates yet.');
  const loadingText = tx(['changelogCard', 'loading'], 'Loading changelog...');
  const openDetailsText = tx(['changelogCard', 'openDetails'], 'Open details');

  const formattedEntries = changelogEntries.map(entry => {
    const date = new Date(entry.date);
    const formattedDate = Number.isNaN(date.getTime())
      ? entry.date
      : formatStoredDateWithOptions(
          date,
          { day: '2-digit', month: 'short', year: 'numeric' },
          locale || 'ru',
        );

    return { ...entry, dateLabel: formattedDate };
  });

  return (
    <Stack spacing={2}>
      {changelogLoading ? (
        <Box
          sx={{
            borderRadius: tokens.radius.lg,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            px: 2.5,
            py: 4,
            fontSize: 14,
            color: 'text.secondary',
          }}
        >
          {loadingText}
        </Box>
      ) : formattedEntries.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: tokens.radius.lg,
            border: '1px dashed',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            px: 2.5,
            py: 7,
            textAlign: 'center',
          }}
        >
          <FileText style={{ marginBottom: 12, width: 32, height: 32, color: c.ink400 }} />
          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {emptyText}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {formattedEntries.map(entry => (
            <Box
              component="button"
              key={entry.id}
              type="button"
              onClick={() => setChangelogSelectedEntry(entry)}
              sx={{
                width: '100%',
                borderRadius: tokens.radius.lg,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                px: 2.5,
                py: 2.5,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.light',
                  bgcolor: 'action.hover',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 1.5,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      lineHeight: 1.3,
                      color: 'text.primary',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {entry.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 1,
                      lineHeight: 1.75,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {entry.summary}
                  </Typography>
                </Box>

                {entry.version ? (
                  <Chip
                    label={entry.version}
                    size="small"
                    variant="outlined"
                    sx={{ flexShrink: 0, fontWeight: 600 }}
                  />
                ) : null}
              </Box>

              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    fontSize: 12,
                    color: 'text.secondary',
                  }}
                >
                  <CalendarDays style={{ width: 14, height: 14 }} />
                  {entry.dateLabel}
                </Box>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    fontSize: 12,
                    color: 'text.secondary',
                  }}
                >
                  <Clock3 style={{ width: 14, height: 14 }} />
                  {openDetailsText}
                </Box>
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      <ChangelogModal
        isOpen={Boolean(changelogSelectedEntry)}
        onClose={() => setChangelogSelectedEntry(null)}
        entry={changelogSelectedEntry}
        releaseLabel={releaseLabelText}
        closeLabel={closeLabelText}
      />
    </Stack>
  );
}
