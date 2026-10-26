'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { ShortcutHint } from '@/app/components/command-palette/ShortcutHint';
import { BookOpen, ExternalLink, Keyboard, PlayCircle } from '@/app/components/icons';
import { closeAppPanel, useAppPanelState } from '@/app/components/panels/app-panels-store';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { openGuide } from '@/app/components/welcome-tutorial/welcome-tutorial-store';
import { useIntlayer } from '@/app/i18n';
import { SHORTCUT_SHOW_SHORTCUTS } from '@/app/lib/keyboard-shortcuts';
import { tokens } from '@/lib/theme-tokens';

const DOCUMENTATION_URL = 'https://stoic-budget.github.io/stoic-budget/docs/getting-started/configuration';

const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  width: '100%',
  px: 1,
  py: 1.25,
  border: 'none',
  borderRadius: tokens.radius.md,
  bgcolor: 'transparent',
  font: 'inherit',
  fontSize: 14,
  fontWeight: 500,
  textAlign: 'left',
  textDecoration: 'none',
  color: 'text.primary',
  cursor: 'pointer',
  '&:hover': { bgcolor: 'action.hover' },
} as const;

/** Help, opened from the "?" in the sidebar: the documentation, the guide and the shortcuts. */
export function HelpPanel(): React.JSX.Element {
  const { panel } = useAppPanelState();
  const { help } = useIntlayer('navigation');

  return (
    <DrawerShell
      isOpen={panel === 'help'}
      onClose={closeAppPanel}
      position="right"
      width="sm"
      title={help.title}
      zIndex={1300}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box
          component="a"
          href={DOCUMENTATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeAppPanel}
          sx={rowSx}
        >
          <BookOpen size={18} />
          <Box component="span" sx={{ flex: 1 }}>
            {help.documentation}
          </Box>
          <ExternalLink size={14} style={{ opacity: 0.5 }} />
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => {
            closeAppPanel();
            openGuide();
          }}
          sx={rowSx}
        >
          <PlayCircle size={18} />
          <span>{help.takeTour}</span>
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => {
            closeAppPanel();
            window.dispatchEvent(new CustomEvent(SHORTCUT_SHOW_SHORTCUTS));
          }}
          sx={rowSx}
        >
          <Keyboard size={18} />
          <Box component="span" sx={{ flex: 1 }}>
            {help.keyboardShortcuts}
          </Box>
          <ShortcutHint binding="Shift+Slash" />
        </Box>
      </Box>
    </DrawerShell>
  );
}
