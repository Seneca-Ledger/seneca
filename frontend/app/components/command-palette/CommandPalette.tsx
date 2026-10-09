'use client';

import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useCallback, useState } from 'react';
import {
  buildNavItems,
  buildUserMenuNavItems,
} from '@/app/components/navigation/helpers/navigation-config';
import { useIntlayer } from '@/app/i18n';
import { isExperimentalModeEnabled, setExperimentalModeEnabled } from '@/app/lib/experimental-mode';
import { closeCommandPalette, useCommandPaletteOpen } from './command-palette-store';
import { buildCommands, type Command, navLabelText } from './command-registry';
import { PaletteInput } from './PaletteInput';
import { PaletteList } from './PaletteList';
import { usePaletteKeyboard } from './use-palette-keyboard';
import { type PaletteRow, usePaletteSections } from './use-palette-sections';
import { usePaletteShortcuts } from './use-palette-shortcuts';

const REPORT_BUG_URL = 'https://github.com/SymonBaikov/lumio/issues/new';

function PaletteBody({ onOpenHelp }: { onOpenHelp: () => void }): React.JSX.Element {
  const t = useIntlayer('commandPalette');
  const { nav, shell, userMenu } = useIntlayer('navigation');
  const notifications = useIntlayer('notificationDropdown');
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [input, setInput] = useState('');

  const commands = buildCommands({
    labels: {
      uploadStatement: t.uploadStatement.value,
      openFilters: t.openFilters.value,
      toggleLeftNav: t.toggleLeftNav.value,
      toggleTheme: t.toggleTheme.value,
      toggleExperimental: t.toggleExperimental.value,
      keyboardShortcuts: t.keyboardShortcuts.value,
      notifications: notifications.title.value,
      settings: navLabelText(userMenu.settings),
      whatsNew: navLabelText(userMenu.whatsNew),
      reportBug: navLabelText(shell.reportBug),
    },
    navItems: [...buildNavItems(nav), ...buildUserMenuNavItems(nav)],
    push: href => router.push(href),
    toggleTheme: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
    toggleExperimental: () => setExperimentalModeEnabled(!isExperimentalModeEnabled()),
    openHelp: onOpenHelp,
    reportBugUrl: REPORT_BUG_URL,
  });

  const { sections, rows } = usePaletteSections(input, commands);

  // Closing first: a command that opens a drawer would otherwise dim itself
  // through the drawer stack's `data-lumio-covered` rule.
  const run = (row: PaletteRow): void => {
    closeCommandPalette();
    if (row.kind === 'command') {
      row.command.run();
    } else {
      router.push(row.result.href);
    }
  };

  const { activeIndex, setActiveIndex, onKeyDown } = usePaletteKeyboard(
    rows,
    run,
    closeCommandPalette,
  );

  const runCommand = useCallback((command: Command) => {
    closeCommandPalette();
    command.run();
  }, []);
  const { onKeyDown: onShortcutKeyDown, pending } = usePaletteShortcuts({
    commands,
    inputEmpty: input === '',
    onRun: runCommand,
    onFlush: setInput,
  });

  // The advertised shortcuts get first refusal on a key; whatever they leave
  // alone falls through to the cursor and the search field.
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (!onShortcutKeyDown(event)) {
      onKeyDown(event);
    }
  };

  return (
    <>
      <PaletteInput
        value={input}
        onChange={setInput}
        onKeyDown={handleKeyDown}
        pending={pending}
        activeRowId={rows[activeIndex] ? `command-palette-row-${rows[activeIndex].id}` : undefined}
      />
      {rows.length === 0 ? (
        <Typography sx={{ py: 4, textAlign: 'center', fontSize: 14, color: 'text.secondary' }}>
          {t.noResults}
        </Typography>
      ) : (
        <PaletteList
          sections={sections}
          rows={rows}
          activeIndex={activeIndex}
          onHover={setActiveIndex}
          onSelect={run}
        />
      )}
    </>
  );
}

export default function CommandPalette({
  onOpenHelp,
}: {
  onOpenHelp: () => void;
}): React.JSX.Element {
  const open = useCommandPaletteOpen();

  return (
    <Dialog
      open={open}
      onClose={closeCommandPalette}
      fullWidth
      maxWidth="sm"
      slotProps={{
        // Near the top rather than centred, which is where a palette is expected.
        container: { sx: { alignItems: 'flex-start' } },
        paper: {
          sx: { mt: '12vh', maxWidth: 640, bgcolor: 'background.paper', overflow: 'hidden' },
        },
      }}
    >
      {/* Unmounted while closed, so the input and the typed query start fresh. */}
      {open && <PaletteBody onOpenHelp={onOpenHelp} />}
    </Dialog>
  );
}
