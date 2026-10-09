'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ShortcutHint } from '@/app/components/command-palette/ShortcutHint';
import { buildNavItems } from '@/app/components/navigation/helpers/navigation-config';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import {
  GLOBAL_SHORTCUTS,
  NAV_BINDINGS,
  type ShortcutEntry,
  STATEMENTS_SHORTCUTS,
} from '@/app/lib/keyboard-shortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ShortcutLine({
  label,
  binding,
}: {
  label: React.ReactNode;
  binding: string;
}): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75 }}>
      <Typography variant="body2">{label}</Typography>
      <ShortcutHint binding={binding} />
    </Box>
  );
}

function ShortcutRow({ entry }: { entry: ShortcutEntry }): React.JSX.Element {
  const { labels } = useIntlayer('keyboardShortcutsModal');
  return <ShortcutLine label={labels[entry.labelKey]} binding={entry.binding} />;
}

/** Navigation rows borrow the sidebar's own translated names. */
function NavigationShortcuts(): React.JSX.Element {
  const { nav } = useIntlayer('navigation');
  const items = buildNavItems(nav).filter(item => NAV_BINDINGS[item.path]);
  return (
    <>
      {items.map(item => (
        <ShortcutLine key={item.path} label={item.label} binding={NAV_BINDINGS[item.path]} />
      ))}
    </>
  );
}

function ShortcutGroup({
  title,
  entries,
}: {
  title: React.ReactNode;
  entries: ShortcutEntry[];
}): React.JSX.Element {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
        {title}
      </Typography>
      {entries.map(entry => (
        <ShortcutRow key={entry.binding} entry={entry} />
      ))}
    </Box>
  );
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps): React.JSX.Element {
  const t = useIntlayer('keyboardShortcutsModal');

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t.title} size="sm">
      <Box sx={{ p: 1 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
            {t.groups.navigation}
          </Typography>
          <NavigationShortcuts />
        </Box>
        <ShortcutGroup title={t.groups.actions} entries={GLOBAL_SHORTCUTS} />
        <ShortcutGroup title={t.groups.statements} entries={STATEMENTS_SHORTCUTS} />
      </Box>
    </ModalShell>
  );
}
