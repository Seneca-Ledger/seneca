'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { useState } from 'react';
import { ChevronDown } from '@/app/components/icons';

/** One folded part of Holdings: the editing lives here, out of the way of the figures. */
export function HoldingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
      <Box
        component="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          py: 1.75,
          border: 0,
          background: 'none',
          font: 'inherit',
          fontSize: 14,
          color: 'text.primary',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {title}
        <ChevronDown
          size={16}
          aria-hidden
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </Box>
      {open && <Box sx={{ pb: 2.5 }}>{children}</Box>}
    </Box>
  );
}
