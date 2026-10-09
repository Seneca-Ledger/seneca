'use client';

import type React from 'react';
import { NotificationsPanel } from '@/app/components/notifications/NotificationsPanel';
import { WhatsNewPanel } from '@/app/components/whats-new/WhatsNewPanel';
import { IntegrationsPanel } from '@/app/integrations/panel/IntegrationsPanel';
import { PluginsPanel } from '@/app/plugins/panel/PluginsPanel';

/**
 * Every panel the account menu and the sidebar can open, mounted once for the
 * whole app so any entry point can slide one over the page the user is on.
 */
export function AppPanels(): React.JSX.Element {
  return (
    <>
      <IntegrationsPanel />
      <PluginsPanel />
      <NotificationsPanel />
      <WhatsNewPanel />
    </>
  );
}
