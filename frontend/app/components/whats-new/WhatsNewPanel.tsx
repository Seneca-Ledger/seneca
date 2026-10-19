'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronRight, Sparkles } from '@/app/components/icons';
import {
  closeAppPanel,
  closeAppPanelItem,
  openAppPanelItem,
  useAppPanelState,
} from '@/app/components/panels/app-panels-store';
import { PanelBackTitle } from '@/app/components/panels/panel-ui';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { useChangelog } from '@/app/settings/profile/hooks/useChangelog';
import { tokens } from '@/lib/theme-tokens';

/**
 * The changelog as a panel, opened from the account menu. The same entries the
 * settings page lists, in the two-layer shape every other panel uses: releases
 * first, one release's notes on top of it.
 */
export function WhatsNewPanel(): React.JSX.Element {
  const { panel, item } = useAppPanelState();
  const open = panel === 'whatsNew';
  const { user } = useAuth();
  const { locale } = useLocale();
  const { userMenu, whatsNew } = useIntlayer('navigation');
  // The list is only fetched once the panel has been opened at least once.
  const { changelogEntries, changelogLoading } = useChangelog(Boolean(user) && open, open);

  const selected = changelogEntries.find(entry => entry.id === item) ?? null;

  const formatDate = (value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : formatStoredDateWithOptions(
          date,
          { day: '2-digit', month: 'short', year: 'numeric' },
          locale ?? 'en',
        );
  };

  return (
    <>
      <DrawerShell
        isOpen={open}
        onClose={closeAppPanel}
        position="right"
        width="md"
        title={userMenu.whatsNew}
        zIndex={1300}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {changelogLoading && changelogEntries.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {whatsNew.loading}
            </Typography>
          ) : null}

          {!changelogLoading && changelogEntries.length === 0 ? (
            <Box
              sx={{ display: 'grid', placeItems: 'center', gap: 1, py: 6, color: 'text.secondary' }}
            >
              <Sparkles size={28} />
              <Typography sx={{ fontSize: 13 }}>{whatsNew.empty}</Typography>
            </Box>
          ) : null}

          <Box sx={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {changelogEntries.map(entry => (
              <Box
                component="button"
                type="button"
                key={entry.id}
                onClick={() => {
                  openAppPanelItem(entry.id);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  width: '100%',
                  px: 1,
                  py: 1.25,
                  border: 'none',
                  borderRadius: tokens.radius.md,
                  bgcolor: 'transparent',
                  textAlign: 'left',
                  color: 'text.primary',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{entry.title}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {[entry.version, formatDate(entry.date)].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <ChevronRight size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
              </Box>
            ))}
          </Box>
        </Box>
      </DrawerShell>

      <DrawerShell
        isOpen={open && Boolean(selected)}
        onClose={closeAppPanel}
        position="right"
        width="md"
        title={<PanelBackTitle onBack={closeAppPanelItem} title={selected?.title ?? ''} />}
        zIndex={1400}
      >
        <Box sx={{ overflowY: 'auto', fontSize: 14, lineHeight: 1.6 }}>
          <ReactMarkdown>{selected?.markdown ?? ''}</ReactMarkdown>
        </Box>
      </DrawerShell>
    </>
  );
}
