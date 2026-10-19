import type { SxProps, Theme } from '@mui/material/styles';

// The theme wraps scrollable tabs in 4px of focus-ring room with a -4px margin (theme.ts,
// MuiTabs); width and bottom margin here take that into account.
export const sharedMuiTabsSx: SxProps<Theme> = {
  mb: { xs: 1.5, sm: 1.5 },
  width: 'calc(100% + 8px)',
  maxWidth: 'calc(100% + 8px)',
  minWidth: 0,
  overflow: 'hidden',
  '& .MuiTabs-scroller': { overflowX: 'auto !important' },
  '& .MuiTabs-flexContainer': { width: 'max-content' },
  '& .MuiTab-root': {
    minWidth: { xs: 104, md: 90 },
    px: { xs: 1.5, md: 2 },
    fontSize: { xs: 16, md: 14 },
  },
};
