'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';

const OFFER_MS = 12000;

/**
 * A toast that asks one question with one action, such as "apply this category
 * to the payee's other rows too?". Dismissing it changes nothing.
 */
export function offerAction(options: {
  message: string;
  applyLabel: string;
  dismissLabel: string;
  onApply: () => void;
}): void {
  const id = toast.custom(
    current => (
      <Paper
        role="status"
        elevation={6}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
          maxWidth: 520,
          opacity: current.visible ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}
      >
        <Typography variant="body2" sx={{ flex: 1 }}>
          {options.message}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button size="small" onClick={() => toast.dismiss(id)}>
            {options.dismissLabel}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              toast.dismiss(id);
              options.onApply();
            }}
          >
            {options.applyLabel}
          </Button>
        </Box>
      </Paper>
    ),
    { duration: OFFER_MS },
  );
}
