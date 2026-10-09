'use client';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { useStatementsQueue } from './statements-queue-context';

type TabId = 'submit' | 'pay' | 'receive';

type QueueTab = {
  id: TabId;
  label: string;
  href: string;
  badge: number | null;
  badgeLoading: boolean;
};

// The tab for a URL: /statements/<tab>[/...]; nothing elsewhere.
export function getStatementsActiveTab(pathname: string | null): TabId | undefined {
  const segment = pathname?.match(/^\/statements\/([^/]+)/)?.[1];
  return (['submit', 'pay', 'receive'] as const).find(tab => tab === segment);
}

// A count still loading is left off the label rather than swapped for a spinner,
// which would make the tab width jump as the counts land.
function tabLabel(tab: QueueTab): string {
  if (tab.badge === null || tab.badgeLoading) {
    return tab.label;
  }
  return `${tab.label} (${tab.badge})`;
}

/**
 * The statements page tabs: Documents (every uploaded statement and receipt;
 * the route keeps its old /submit name), Pay and Receive. What waits for a
 * decision lives in Review. Each tab is its own route, so deep links and the
 * back button keep working; switching tabs only swaps the view below.
 */
export function StatementsQueueTabs(): React.JSX.Element {
  const t = useIntlayer('statementsPage');
  const pathname = usePathname();
  const activeTab = getStatementsActiveTab(pathname);
  const { payCount, payCountLoading } = useStatementsQueue();

  const tx = (path: string[], fallback: string): string =>
    resolveLabel(getNestedValue(t, path), fallback);

  const tabs: QueueTab[] = [
    {
      id: 'submit',
      label: tx(['sidePanel', 'documents'], 'Documents'),
      href: '/statements/submit',
      badge: null,
      badgeLoading: false,
    },
    {
      id: 'pay',
      label: tx(['sidePanel', 'pay'], 'Pay'),
      href: '/statements/pay',
      badge: payCount,
      badgeLoading: payCountLoading,
    },
    {
      id: 'receive',
      label: tx(['sidePanel', 'receive'], 'Receive'),
      href: '/statements/receive',
      badge: null,
      badgeLoading: false,
    },
  ];

  return (
    <Tabs
      value={activeTab ?? false}
      variant="scrollable"
      scrollButtons={false}
      aria-label={tx(['sidePanel', 'workQueueTitle'], 'Work queue')}
      data-tour-id="statements-queue-tabs"
      sx={{ ...sharedMuiTabsSx, mb: 0 }}
    >
      {tabs.map(tab => (
        <Tab key={tab.id} value={tab.id} component={Link} href={tab.href} label={tabLabel(tab)} />
      ))}
    </Tabs>
  );
}
