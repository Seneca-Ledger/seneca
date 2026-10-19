'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ShortcutHint } from '@/app/components/command-palette/ShortcutHint';
import {
  buildNavItems,
  buildUserMenuNavItems,
} from '@/app/components/navigation/helpers/navigation-config';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import {
  GLOBAL_SHORTCUTS,
  NAV_BINDINGS,
  NOTIFICATIONS_BINDING,
  SETTINGS_BINDING,
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
  const items = [...buildNavItems(nav), ...buildUserMenuNavItems(nav)].filter(
    item => NAV_BINDINGS[item.path],
  );
  return (
    <>
      {items.map(item => (
        <ShortcutLine key={item.path} label={item.label} binding={NAV_BINDINGS[item.path]} />
      ))}
    </>
  );
}

/** Actions whose names already live in the dictionaries of the panels they open. */
function BorrowedActionShortcuts(): React.JSX.Element {
  const { userMenu } = useIntlayer('navigation');
  const notifications = useIntlayer('notificationDropdown');
  return (
    <>
      <ShortcutLine label={notifications.title} binding={NOTIFICATIONS_BINDING} />
      <ShortcutLine label={userMenu.settings} binding={SETTINGS_BINDING} />
    </>
  );
}

function ShortcutGroup({
  title,
  entries,
  children,
}: {
  title: React.ReactNode;
  entries: ShortcutEntry[];
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
        {title}
      </Typography>
      {entries.map(entry => (
        <ShortcutRow key={entry.binding} entry={entry} />
      ))}
      {children}
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
        <ShortcutGroup title={t.groups.actions} entries={GLOBAL_SHORTCUTS}>
          <BorrowedActionShortcuts />
        </ShortcutGroup>
        <ShortcutGroup title={t.groups.statements} entries={STATEMENTS_SHORTCUTS} />
      </Box>
    </ModalShell>
  );
}
