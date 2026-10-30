import Box from '@mui/material/Box';
import type React from 'react';
import { SkeletonBoxes } from '@/app/components/ui/snapshot-skeleton/SkeletonBoxes';
import { useSkeletonSnapshot } from '@/app/hooks/useSkeletonSnapshot';
import { useIntlayer } from '@/app/i18n';
import type { SkeletonSnapshot } from '@/app/lib/snapshot-skeleton/snapshot';
import { SettingsTabs } from '@/app/settings/profile/components/SettingsTabs';
import type { SettingsTabId } from '@/app/settings/profile/helpers/settings-url-state';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';
import { tokens } from '@/lib/theme-tokens';

/** The id a tab's layout is remembered under, so its skeleton replays the last visit. */
export const settingsTabSnapshotId = (tab: SettingsTabId): string => `settings-tab-${tab}`;

const noop = (): void => {};

const PANEL_RADIUS = Number.parseInt(tokens.radius.md, 10);
const PANEL_HEIGHT = 64;
const PANEL_COUNT = 5;
const PANEL_GAP = 16;

/**
 * First visit, before a tab's layout was remembered: the stack of collapsed
 * panels most tabs are made of (icon, title, one line of description).
 */
const PANEL_STACK: SkeletonSnapshot = {
  h: PANEL_COUNT * PANEL_HEIGHT + (PANEL_COUNT - 1) * PANEL_GAP,
  boxes: Array.from({ length: PANEL_COUNT }, (_, index) => {
    const y = index * (PANEL_HEIGHT + PANEL_GAP);
    return [
      { k: 'frame' as const, x: 0, y, w: 10_000, h: PANEL_HEIGHT, r: PANEL_RADIUS },
      { k: 'circle' as const, x: 140, y: y + 23, w: 160, h: 18, r: 9 },
      { k: 'text' as const, x: 360, y: y + 12, w: 1400, h: 20, r: 0 },
      { k: 'text' as const, x: 360, y: y + 33, w: 3200, h: 18, r: 0 },
    ];
  }).flat(),
};

/**
 * The real page frame and tab strip; only the open tab's body is a placeholder,
 * replaying that tab's layout from the last visit.
 */
export function SettingsSkeleton({
  activeTab = 'general',
}: {
  activeTab?: SettingsTabId;
}): React.JSX.Element {
  const { tx } = useSettingsText();
  const shell = useIntlayer('uiShell');
  const { skeletonRef, snapshot } = useSkeletonSnapshot(
    settingsTabSnapshotId(activeTab),
    true,
    false,
  );
  const labels = {
    general: tx(['tabs', 'general']),
    security: tx(['tabs', 'security']),
    notifications: tx(['tabs', 'notifications']),
    data: tx(['tabs', 'data']),
    advanced: tx(['tabs', 'advanced']),
    versions: tx(['tabs', 'versions']),
  };

  return (
    <Box
      className="container-shared"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 32px)', pb: 4 }}
    >
      <SettingsTabs activeTab={activeTab} onTabChange={noop} labels={labels} />
      <SkeletonBoxes
        ref={skeletonRef}
        snapshot={snapshot ?? PANEL_STACK}
        label={shell.loading.value}
      />
    </Box>
  );
}
