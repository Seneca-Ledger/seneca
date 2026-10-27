'use client';

import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  buildNavItems,
  buildUserMenuNavItems,
} from '@/app/components/navigation/helpers/navigation-config';
import { useThemeToggle } from '@/app/components/navigation/hooks/useThemeToggle';
import { PDFPreviewModal } from '@/app/components/PDFPreviewModal';
import { closeAllDrawers } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import { isExperimentalModeEnabled, setExperimentalModeEnabled } from '@/app/lib/experimental-mode';
import { closeCommandPalette, useCommandPaletteOpen } from './command-palette-store';
import { buildCommands, type Command, navLabelText } from './command-registry';
import { PaletteInput } from './PaletteInput';
import { PaletteList } from './PaletteList';
import { PalettePickerBody } from './PalettePickerBody';
import { clearPalettePicker, usePaletteExtras } from './page-commands-store';
import { useHoldPreview } from './use-hold-preview';
import { usePaletteKeyboard } from './use-palette-keyboard';
import { type PaletteRow, usePaletteSections } from './use-palette-sections';
import { usePaletteShortcuts } from './use-palette-shortcuts';

const REPORT_BUG_URL = 'https://github.com/stoic-budget/stoic-budget/issues/new';

function PaletteBody({ onOpenHelp }: { onOpenHelp: () => void }): React.JSX.Element {
  const t = useIntlayer('commandPalette');
  const { nav, shell, userMenu } = useIntlayer('navigation');
  const notifications = useIntlayer('notificationDropdown');
  const { labels: shortcutLabels } = useIntlayer('keyboardShortcutsModal');
  const router = useRouter();
  const pathname = usePathname();
  const toggleTheme = useThemeToggle();
  const [input, setInput] = useState('');

  // A jump lands on the page itself, not behind a drawer left open on top.
  const navigate = (href: string): void => {
    closeAllDrawers();
    router.push(href);
  };

  const commands = buildCommands({
    labels: {
      uploadStatement: t.uploadStatement.value,
      openFilters: t.openFilters.value,
      toggleLeftNav: t.toggleLeftNav.value,
      toggleTheme: t.toggleTheme.value,
      toggleExperimental: t.toggleExperimental.value,
      keyboardShortcuts: t.keyboardShortcuts.value,
      notifications: notifications.title.value,
      previousMonth: shortcutLabels.previousMonth.value,
      nextMonth: shortcutLabels.nextMonth.value,
      settings: navLabelText(userMenu.settings),
      whatsNew: navLabelText(userMenu.whatsNew),
      reportBug: navLabelText(shell.reportBug),
    },
    navItems: [...buildNavItems(nav), ...buildUserMenuNavItems(nav)],
    push: navigate,
    pathname,
    toggleTheme,
    toggleExperimental: () => setExperimentalModeEnabled(!isExperimentalModeEnabled()),
    openHelp: onOpenHelp,
    reportBugUrl: REPORT_BUG_URL,
  });

  const { page } = usePaletteExtras();
  const { sections, rows } = usePaletteSections(input, commands, page);

  // Closing first: a command that opens a drawer would otherwise dim itself
  // through the drawer stack's `data-seneca-covered` rule.
  const run = (row: PaletteRow): void => {
    closeCommandPalette();
    if (row.kind === 'command') {
      row.command.run();
    } else {
      navigate(row.result.href);
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
    commands: page ? [...page.commands, ...commands] : commands,
    inputEmpty: input === '',
    onRun: runCommand,
    onFlush: setInput,
  });

  const activeRow = rows[activeIndex];
  const hold = useHoldPreview(
    activeRow?.kind === 'result' ? activeRow.result.document : null,
    setInput,
  );

  // Holding Space over a file comes first, then the advertised shortcuts;
  // whatever they leave alone falls through to the cursor and the search field.
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (!(hold.onKeyDown(event) || onShortcutKeyDown(event))) {
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
      {hold.previewing && (
        <PDFPreviewModal
          isOpen
          onClose={hold.closePreview}
          fileId={hold.previewing.id}
          fileName={hold.previewing.fileName}
          source={hold.previewing.source}
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
  const { picker } = usePaletteExtras();

  // A picker answers one question; the next open is the usual list again. A
  // command that opens a picker closes and reopens in one batch, so this never
  // sees that hand-over as a close.
  useEffect(() => {
    if (!open) {
      clearPalettePicker();
    }
  }, [open]);

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
      {open &&
        (picker ? (
          <PalettePickerBody key={picker.id} picker={picker} />
        ) : (
          <PaletteBody onOpenHelp={onOpenHelp} />
        ))}
    </Dialog>
  );
}
